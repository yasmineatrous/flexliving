import os
import json
import requests
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from dotenv import load_dotenv
load_dotenv()


# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")

# Hostaway API Configuration
HOSTAWAY_BASE_URL = "https://api.hostaway.com/v1"
HOSTAWAY_ACCOUNT_ID = os.environ.get("HOSTAWAY_ACCOUNT_ID")
HOSTAWAY_API_KEY = os.environ.get("HOSTAWAY_API_KEY")

# Use Flask session for approval storage - clean and reliable

def load_mock_reviews():
    """Load mock reviews from JSON file"""
    try:
        with open('mock_data/reviews.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error("Mock data file not found")
        return []
    except json.JSONDecodeError:
        logging.error("Invalid JSON in mock data file")
        return []

def get_hostaway_access_token():
    """Get OAuth access token for Hostaway API"""
    try:
        if not HOSTAWAY_API_KEY or not HOSTAWAY_ACCOUNT_ID:
            return None
            
        # OAuth 2.0 token request - use URL-encoded format
        token_url = f"{HOSTAWAY_BASE_URL}/accessTokens"
        payload = f"grant_type=client_credentials&client_id={HOSTAWAY_ACCOUNT_ID}&client_secret={HOSTAWAY_API_KEY}&scope=general"
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache'
        }
        
        response = requests.post(token_url, data=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get('access_token')
            if access_token:
                logging.info("Successfully obtained Hostaway access token")
                return access_token
            else:
                logging.error("No access token in response")
                return None
        else:
            logging.error(f"Token request failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logging.error(f"Error getting Hostaway access token: {e}")
        return None

def fetch_hostaway_reviews():
    """Fetch reviews from Hostaway API with proper OAuth authentication"""
    try:
        # Check if API credentials are available
        if not HOSTAWAY_API_KEY or not HOSTAWAY_ACCOUNT_ID:
            logging.error("Missing Hostaway API credentials. Please set HOSTAWAY_API_KEY and HOSTAWAY_ACCOUNT_ID.")
            return []
        
        # Get OAuth access token
        access_token = get_hostaway_access_token()
        if not access_token:
            logging.error("Could not obtain access token. Check your API credentials.")
            return []
            
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
        
        url = f"{HOSTAWAY_BASE_URL}/reviews"
        params = {'accountId': HOSTAWAY_ACCOUNT_ID}
        
        logging.info(f"Fetching Hostaway reviews from: {url} with account ID: {HOSTAWAY_ACCOUNT_ID}")
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                reviews = data.get('result', [])
                count = data.get('count', 0)
                
                if count > 0:
                    logging.info(f"Successfully fetched {len(reviews)} authentic Hostaway reviews")
                    return reviews
                else:
                    logging.info("Your Hostaway account has no reviews yet. Create some reviews in Hostaway first.")
                    return []
            else:
                logging.error(f"API returned error status: {data}")
                return []
        else:
            logging.error(f"API request failed: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        logging.error(f"Error fetching Hostaway reviews: {e}")
        return []

def normalize_review(review, source="Hostaway"):
    """Normalize review data structure"""
    if source == "google":
        # Google reviews are already normalized, just ensure approval status
        review_id = str(review.get('id'))
        
        # Check approval status from session
        if 'approved_reviews' not in session:
            session['approved_reviews'] = {}
        is_approved = session['approved_reviews'].get(review_id, False)
        
        # Return Google review with approval status
        review['approved'] = is_approved
        return review
    
    elif source in ["Hostaway", "Demo"]:
        # Get category ratings from reviewCategory array
        review_categories = review.get('reviewCategory', [])
        overall_rating = 0
        
        # Calculate overall rating from category ratings
        if review_categories:
            total_rating = sum(cat.get('rating', 0) for cat in review_categories)
            overall_rating = round(total_rating / len(review_categories))
        
        # Create normalized structure
        review_id = str(review.get('id'))
        
        # Convert category ratings to both original and normalized formats
        category_ratings_display = []
        review_category = {}
        
        if review_categories:
            for cat in review_categories:
                category_name = cat.get('category', '').lower()
                rating = cat.get('rating', 0)
                
                # For display in dashboard (preserve original structure)
                category_ratings_display.append({
                    'category': category_name,
                    'rating': rating
                })
                
                # For internal processing and filtering
                review_category[category_name] = rating
        
        # Parse date
        review_date = None
        if review.get('submittedAt'):
            try:
                from datetime import datetime
                review_date = datetime.fromisoformat(review.get('submittedAt').replace('Z', '+00:00'))
            except:
                review_date = None
        
        # Check approval status from session
        if 'approved_reviews' not in session:
            session['approved_reviews'] = {}
        is_approved = session['approved_reviews'].get(review_id, False)
        
        return {
            'id': review_id,
            'listing_id': review.get('listingId', 'unknown'),
            'listing_name': review.get('listingName', 'Unknown Property'),
            'guest_name': review.get('guestName', 'Anonymous'),
            'guest_location': review.get('guestLocation', ''),
            'review_text': review.get('publicReview', ''),
            'overall_rating': int(overall_rating) if overall_rating else 5,
            'category_ratings': category_ratings_display,  # Correct format for display
            'review_category': review_category,    # Parsed format for filtering
            'review_date': review_date,
            'date': review.get('submittedAt', ''), # Keep original date field too
            'channel': source,
            'approved': is_approved
        }
    
    return review

def get_all_reviews():
    """Get all reviews from multiple sources: Hostaway API and Google Reviews"""
    all_reviews = []
    
    # Get Hostaway reviews
    hostaway_reviews = fetch_hostaway_reviews()
    if hostaway_reviews:
        normalized_hostaway = [normalize_review(review, source="Hostaway") for review in hostaway_reviews]
        all_reviews.extend(normalized_hostaway)
        logging.info(f"✓ Loaded {len(normalized_hostaway)} authentic Hostaway reviews")
    else:
        # Fallback to demo data when no real reviews exist
        mock_reviews = load_mock_reviews()
        if mock_reviews:
            normalized_mock = [normalize_review(review, source="Demo") for review in mock_reviews]
            all_reviews.extend(normalized_mock)
            logging.info(f"⚠ No reviews in Hostaway account - showing {len(normalized_mock)} demo reviews for testing")
    
    # Get Google Reviews
    try:
        from google_reviews import fetch_google_reviews
        google_reviews = fetch_google_reviews()
        if google_reviews:
            # Google reviews are already normalized
            google_normalized = [normalize_review(review, source='google') for review in google_reviews]
            all_reviews.extend(google_normalized)
            logging.info(f"Added {len(google_normalized)} Google Reviews")
    except Exception as e:
        logging.warning(f"Could not fetch Google Reviews: {e}")
    
    logging.info(f"Total reviews from all sources: {len(all_reviews)}")
    return all_reviews

@app.route('/')
def index():
    """Landing page with all approved reviews"""
    return redirect(url_for('reviews_display'))

@app.route('/reviews')
def reviews_display():
    """Public reviews display page showing all approved reviews"""
    all_reviews = get_all_reviews()
    
    # Debug: Log all reviews and their approval status
    logging.info(f"Total reviews loaded: {len(all_reviews)}")
    for review in all_reviews:
        logging.info(f"Review {review['id']}: approved={review['approved']}")
    
    approved_reviews = [r for r in all_reviews if r['approved']]
    logging.info(f"Approved reviews count: {len(approved_reviews)}")
    
    # Calculate statistics
    total_reviews = len(approved_reviews)
    total_properties = len(set(r['listing_id'] for r in approved_reviews)) if approved_reviews else 0
    
    # Calculate average rating
    average_rating = 0
    if approved_reviews:
        total_rating = sum(review['overall_rating'] for review in approved_reviews)
        average_rating = round(total_rating / len(approved_reviews), 1)
    
    return render_template('reviews_display.html',
                         approved_reviews=approved_reviews,
                         total_reviews=total_reviews,
                         average_rating=average_rating,
                         total_properties=total_properties)

@app.route('/dashboard')
def dashboard():
    """Manager dashboard page"""
    return render_template('dashboard.html')

@app.route('/property/<int:property_id>')
def property_page(property_id):
    """Property-specific page showing approved reviews"""
    reviews = get_all_reviews()
    property_reviews = [r for r in reviews if str(r['listing_id']) == str(property_id) and r['approved']]
    
    # Get property name from first review or use generic name
    property_name = "Property"
    if property_reviews:
        property_name = property_reviews[0]['listing_name']
    elif reviews:
        # Find any review for this property to get the name
        for review in reviews:
            if str(review['listing_id']) == str(property_id):
                property_name = review['listing_name']
                break
    
    # Calculate average rating
    average_rating = 0
    if property_reviews:
        total_rating = sum(review['overall_rating'] for review in property_reviews)
        average_rating = round(total_rating / len(property_reviews), 1)
    
    return render_template('property.html', 
                         property_name=property_name, 
                         property_id=property_id,
                         reviews=property_reviews,
                         average_rating=average_rating)

@app.route('/api/reviews/hostaway')
def api_hostaway_reviews():
    """API endpoint to get normalized Hostaway reviews"""
    reviews = get_all_reviews()
    return jsonify({'status': 'success', 'reviews': reviews})

@app.route('/api/reviews/approve', methods=['POST'])
def api_approve_review():
    """API endpoint to approve/unapprove reviews"""
    try:
        data = request.get_json()
        review_id = str(data.get('review_id'))
        approved = data.get('approved', False)
        
        # Store approval status in session
        if 'approved_reviews' not in session:
            session['approved_reviews'] = {}
        
        session['approved_reviews'][review_id] = approved
        session.modified = True
        
        # Log the approval action for debugging
        total_approved = len([k for k, v in session['approved_reviews'].items() if v])
        logging.info(f"Review {review_id} {'approved' if approved else 'unapproved'}. Total approved: {total_approved}")
        
        return jsonify({
            'status': 'success', 
            'review_id': review_id, 
            'approved': approved,
            'message': f'Review {review_id} {"approved" if approved else "unapproved"} successfully'
        })
    except Exception as e:
        logging.error(f"Error approving review: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/reviews/status')
def api_review_status():
    """API endpoint to get current approval status for debugging"""
    if 'approved_reviews' not in session:
        session['approved_reviews'] = {}
    
    return jsonify({
        'status': 'success',
        'approval_status': session['approved_reviews'],
        'total_approved': len([k for k, v in session['approved_reviews'].items() if v])
    })

@app.route('/api/reviews/reset', methods=['POST'])
def api_reset_approvals():
    """Reset all approval statuses to unapproved"""
    try:
        session['approved_reviews'] = {}
        session.modified = True
        logging.info("All review approvals have been reset")
        return jsonify({'status': 'success', 'message': 'All approvals reset successfully'})
    except Exception as e:
        logging.error(f"Error resetting approvals: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/reviews/google')
def api_google_reviews():
    """Endpoint for Google Reviews integration with user-provided API key"""
    try:
        from google_reviews import fetch_google_reviews
        
        # Get API key from request parameters
        api_key = request.args.get('api_key')
        place_id = request.args.get('place_id', 'ChIJd8BlQ2BZwokRAFUEcm_qrcA')
        
        if not api_key:
            return jsonify({
                'status': 'error',
                'message': 'Google Places API key is required'
            }), 400
        
        # Fetch Google Reviews with user's API key
        reviews = fetch_google_reviews(place_id=place_id, api_key=api_key)
        
        if reviews:
            logging.info(f"Successfully fetched {len(reviews)} Google Reviews")
            return jsonify({
                'status': 'success', 
                'reviews': reviews,
                'total_reviews': len(reviews),
                'message': f'Successfully retrieved {len(reviews)} authentic Google Reviews'
            })
        else:
            return jsonify({
                'status': 'warning',
                'reviews': [],
                'total_reviews': 0,
                'message': 'No Google Reviews found for this location'
            })
            
    except Exception as e:
        logging.error(f"Error in Google Reviews API endpoint: {e}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch Google Reviews. Please check your API key and try again.'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
