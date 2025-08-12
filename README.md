# Flex Living Reviews Dashboard

A Flask-based web application for managing property reviews from Hostaway and other platforms. This dashboard allows property managers to review, approve, and display guest feedback in a clean, responsive interface.

## Features

- **Review Management**: View all reviews in a filterable and sortable dashboard
- **Approval System**: Approve or unapprove reviews for public display
- **Property Pages**: Individual property pages showing approved reviews only
- **Hostaway Integration**: Fetches reviews from Hostaway API with fallback to mock data
- **Responsive Design**: Mobile-friendly interface using Bootstrap 5
- **Google Reviews Ready**: Placeholder integration for future Google Reviews API

## Live Demo
- Access the live deployed app here: https://flexlivingdashboard.vercel.app/reviews



## Tech Stack

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript
- **API Integration**: Hostaway API
- **Deployment**: Vercel-ready configuration

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd flexliving
```
2.Create a virtual environment and install dependencies:
```bash
python -m venv venv
# Activate the virtual environment:
source venv/bin/activate    # Linux/macOS
venv\Scripts\activate       # Windows

pip install -r requirements.txt

```
3.Create a .env file in the project root with the following variables:
```bash
SESSION_SECRET=your_secret_key_here
HOSTAWAY_ACCOUNT_ID=61148
HOSTAWAY_API_KEY=your_hostaway_api_key_here
```
4. (Optional) To enable Google Reviews integration, add your Google Places API key when calling the API or set it in your frontend:


