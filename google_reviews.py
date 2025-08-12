"""
Google Reviews integration module
Integrates with Google Places API to fetch authentic reviews
"""
import os
import requests
import logging
from datetime import datetime

def fetch_google_reviews(place_id="ChIJd8BlQ2BZwokRAFUEcm_qrcA", api_key=None):
    """
    Fetch reviews from Google Places API for a specific place
    
    Args:
        place_id (str): Google Places API place ID
        api_key (str): Google Places API key
    
    Returns:
        dict: Reviews data with status and reviews list
    """
    
    # Use provided API key or get from environment
    google_api_key = api_key or os.getenv('GOOGLE_PLACES_API_KEY')
    
    if not google_api_key:
        logging.warning("No Google Places API key found - using fallback data")
        return fetch_google_reviews_fallback(place_id)
    
    try:
        # Google Places API endpoint for place details with reviews
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            'place_id': place_id,
            'fields': 'name,rating,reviews,formatted_address,geometry',
            'key': google_api_key,
            'language': 'fr'  # French language preference
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 'OK':
            logging.error(f"Google Places API error: {data.get('error_message', 'Unknown error')}")
            return fetch_google_reviews_fallback(place_id)
        
        place_details = data.get('result', {})
        reviews = place_details.get('reviews', [])
        
        # Normalize Google Reviews to our format
        normalized_reviews = []
        for i, review in enumerate(reviews):
            normalized_review = {
                'id': f'google_{i+1}',
                'listing_id': place_id,
                'listing_name': place_details.get('name', 'Google Property'),
                'guest_name': review.get('author_name', 'Anonymous'),
                'review_text': review.get('text', ''),
                'overall_rating': review.get('rating', 5),
                'category_ratings': [],  # Google doesn't provide category breakdowns
                'date': datetime.fromtimestamp(review.get('time', 0)).strftime('%Y-%m-%d %H:%M:%S'),
                'channel': 'Google',
                'guest_location': '',
                'approved': False
            }
            normalized_reviews.append(normalized_review)
        
        logging.info(f"Retrieved {len(normalized_reviews)} Google Reviews for place: {place_details.get('name', 'Unknown')}")
        
        return normalized_reviews
        
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching Google Reviews: {e}")
        return fetch_google_reviews_fallback(place_id)
    except Exception as e:
        logging.error(f"Unexpected error fetching Google Reviews: {e}")
        return fetch_google_reviews_fallback(place_id)

def fetch_google_reviews_fallback(place_id="demo_place_id"):
    """
    Fallback data when Google Places API is not available
    Note: This should not be used in production - API key is required for authentic data
    """
    
    # Empty fallback to encourage proper API setup
    logging.warning("Google Places API key required for authentic reviews")
    return []

def get_google_place_id(address, api_key=None):
    """
    Helper function to find Place ID from address
    
    Args:
        address (str): Property address
        api_key (str): Google Places API key
    
    Returns:
        str: Place ID if found, None otherwise
    """
    google_api_key = api_key or os.getenv('GOOGLE_PLACES_API_KEY')
    
    if not google_api_key:
        return None
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        params = {
            'input': address,
            'inputtype': 'textquery',
            'fields': 'place_id,name,formatted_address',
            'key': google_api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') == 'OK' and data.get('candidates'):
            return data['candidates'][0].get('place_id')
        
        return None
        
    except Exception as e:
        logging.error(f"Error finding Place ID: {e}")
        return None