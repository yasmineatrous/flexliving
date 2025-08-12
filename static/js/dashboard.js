// Dashboard JavaScript functionality

let allReviews = [];
let filteredReviews = [];
let currentSort = { column: null, direction: 'asc' };

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadReviews();
    setupEventListeners();
});

function setupEventListeners() {
    // Filter change listeners
    document.getElementById('ratingFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('channelFilter').addEventListener('change', applyFilters);
    document.getElementById('dateFrom').addEventListener('change', applyFilters);
    document.getElementById('dateTo').addEventListener('change', applyFilters);
    
    // Sortable column headers
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const column = this.dataset.column;
            sortReviews(column);
        });
    });
}

async function loadReviews() {
    try {
        showLoading();
        
        const response = await fetch('/api/reviews/hostaway');
        const data = await response.json();
        
        if (data.status === 'success') {
            allReviews = data.reviews;
            filteredReviews = [...allReviews];
            
            // Debug: Log review data structure
            console.log('Loaded reviews count:', allReviews.length);
            console.log('Sample review structure:', allReviews[0]);
            if (allReviews[0] && allReviews[0].category_ratings) {
                console.log('Sample category_ratings:', allReviews[0].category_ratings);
            }
            
            renderReviews();
            hideLoading();
        } else {
            throw new Error('Failed to load reviews');
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        showError('Failed to load reviews. Please try again later.');
    }
}

function renderReviews() {
    const tbody = document.getElementById('reviewsTableBody');
    const container = document.getElementById('reviewsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredReviews.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    tbody.innerHTML = '';
    
    filteredReviews.forEach(review => {
        const row = createReviewRow(review);
        tbody.appendChild(row);
    });
    
    // Update data source indicator
    updateDataSourceIndicator(filteredReviews);
    
    // Update property links
    updatePropertyLinks();
}

function updatePropertyLinks() {
    const propertyLinksContainer = document.getElementById('propertyLinks');
    if (!propertyLinksContainer) return;
    
    // Get unique properties
    const properties = {};
    allReviews.forEach(review => {
        if (!properties[review.listing_id]) {
            properties[review.listing_id] = {
                id: review.listing_id,
                name: review.listing_name,
                approvedCount: 0,
                totalCount: 0
            };
        }
        properties[review.listing_id].totalCount++;
        if (review.approved) {
            properties[review.listing_id].approvedCount++;
        }
    });
    
    // Generate property links
    propertyLinksContainer.innerHTML = '';
    Object.values(properties).forEach(property => {
        const link = document.createElement('a');
        link.href = `/property/${property.id}`;
        link.className = 'btn btn-outline-success btn-sm';
        link.innerHTML = `
            <i class="fas fa-home me-1"></i>
            ${property.name}
            <span class="badge bg-success ms-1">${property.approvedCount}</span>
        `;
        link.title = `${property.approvedCount} approved reviews out of ${property.totalCount} total`;
        propertyLinksContainer.appendChild(link);
    });
}

function createReviewRow(review) {
    const row = document.createElement('tr');
    row.setAttribute('data-review-id', review.id);
    
    // Format date - handle both date and review_date fields
    const dateValue = review.review_date || review.date;
    const date = dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A';
    
    // Generate star rating HTML
    const starsHtml = generateStarsHtml(review.overall_rating);
    
    // Truncate review text
    const reviewText = review.review_text && review.review_text.length > 100 
        ? review.review_text.substring(0, 100) + '...' 
        : (review.review_text || 'No review text');
    
    // Handle category ratings - prioritize the original array format
    const categoryRatings = review.category_ratings;
    
    row.innerHTML = `
        <td data-label="Property">
            <a href="/property/${review.listing_id}" class="text-decoration-none">
                ${review.listing_name}
            </a>
        </td>
        <td data-label="Guest">${review.guest_name}</td>
        <td data-label="Rating">
            <div class="d-flex align-items-center">
                <div class="rating me-2">${starsHtml}</div>
                <span class="small text-muted">${review.overall_rating}</span>
            </div>
        </td>
        <td data-label="Date">${date}</td>
        <td data-label="Channel">
            <span class="badge ${review.channel === 'Demo' ? 'bg-warning text-dark' : 'bg-success'}" 
                  title="${review.channel === 'Demo' ? 'Demo data - Add reviews to your Hostaway account for authentic data' : 'Authentic data from ' + review.channel}">
                ${review.channel === 'Demo' ? 'Demo Data' : review.channel}
            </span>
        </td>
        <td data-label="Categories">
            <div class="categories-list">
                ${generateCategoriesHtml(categoryRatings)}
            </div>
        </td>
        <td data-label="Review">
            <span title="${review.review_text || 'No review text'}">${reviewText}</span>
        </td>
        <td data-label="Approval">
            <span class="${review.approved ? 'status-approved' : 'status-pending'}">
                <i class="fas ${review.approved ? 'fa-check-circle' : 'fa-clock'} me-1"></i>
                ${review.approved ? 'Approved' : 'Pending'}
            </span>
        </td>
        <td data-label="Actions" class="approval-actions">
            <button class="btn btn-sm ${review.approved ? 'btn-outline-warning' : 'btn-outline-success'}" 
                    onclick="toggleApproval('${review.id}', ${!review.approved})">
                <i class="fas ${review.approved ? 'fa-times' : 'fa-check'} me-1"></i>
                ${review.approved ? 'Unapprove' : 'Approve'}
            </button>
        </td>
    `;
    
    return row;
}

function generateStarsHtml(rating) {
    let html = '';
    const maxStars = 10; // Hostaway uses 10-point scale
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // Show first 5 stars as full stars (doubling the rating for 5-star display)
    const displayRating = Math.min(5, Math.ceil(rating / 2));
    
    for (let i = 0; i < Math.floor(displayRating); i++) {
        html += '<i class="fas fa-star text-warning"></i>';
    }
    
    if (displayRating % 1 >= 0.5) {
        html += '<i class="fas fa-star-half-alt text-warning"></i>';
    }
    
    const emptyStars = 5 - Math.ceil(displayRating);
    for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star text-muted"></i>';
    }
    
    return html;
}

function generateCategoriesHtml(categoryRatings) {
    if (!categoryRatings || !Array.isArray(categoryRatings)) {
        return '<span class="text-muted">No categories</span>';
    }
    
    let html = '';
    categoryRatings.forEach(category => {
        const categoryName = category.category || category.categoryName || '';
        const rating = category.rating;
        
        if (categoryName && rating !== undefined && rating !== null) {
            // Format category name for display
            const displayName = categoryName
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            html += `
                <div class="category-item mb-1">
                    <small class="fw-bold text-primary">${displayName}:</small>
                    <span class="badge bg-success text-white ms-1">${rating}/10</span>
                </div>
            `;
        }
    });
    
    return html || '<span class="text-muted">No categories</span>';
}

async function toggleApproval(reviewId, approved) {
    try {
        console.log(`Toggling approval for review ${reviewId} to ${approved}`);
        
        const response = await fetch('/api/reviews/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                review_id: reviewId,
                approved: approved
            })
        });
        
        const data = await response.json();
        console.log('Approval response:', data);
        
        if (data.status === 'success') {
            // Update the review in our local data
            const reviewIndex = allReviews.findIndex(r => r.id === reviewId);
            if (reviewIndex !== -1) {
                allReviews[reviewIndex].approved = approved;
                console.log(`Updated local review ${reviewId} approval status to ${approved}`);
            }
            
            // Update the button state immediately
            updateApprovalButton(reviewId, approved);
            
            // Re-apply filters and render
            applyFilters();
            
            // Show success message
            showToast(approved ? 'Review approved successfully' : 'Review unapproved successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to update approval status');
        }
    } catch (error) {
        console.error('Error toggling approval:', error);
        showToast('Failed to update approval status', 'error');
        
        // Revert the button state
        const button = document.querySelector(`[onclick="toggleApproval('${reviewId}', ${!approved})"]`);
        if (button) {
            updateApprovalButton(reviewId, !approved);
        }
    }
}

function updateApprovalButton(reviewId, approved) {
    const row = document.querySelector(`tr[data-review-id="${reviewId}"]`);
    if (!row) return;
    
    const approvalCell = row.querySelector('.approval-actions');
    if (!approvalCell) return;
    
    if (approved) {
        approvalCell.innerHTML = `
            <button class="btn btn-success btn-sm me-2" disabled>
                <i class="fas fa-check me-1"></i>Approved
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="toggleApproval('${reviewId}', false)">
                <i class="fas fa-times me-1"></i>Unapprove
            </button>
        `;
    } else {
        approvalCell.innerHTML = `
            <button class="btn btn-outline-success btn-sm me-2" onclick="toggleApproval('${reviewId}', true)">
                <i class="fas fa-check me-1"></i>Approve
            </button>
            <button class="btn btn-secondary btn-sm" disabled>
                <i class="fas fa-times me-1"></i>Not Approved
            </button>
        `;
    }
}

async function resetAllApprovals() {
    if (!confirm('Are you sure you want to reset ALL approval statuses? This will unapprove all reviews.')) {
        return;
    }
    
    const resetButton = document.getElementById('resetButton');
    resetButton.disabled = true;
    resetButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Resetting...';
    
    try {
        const response = await fetch('/api/reviews/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // Update all reviews to unapproved in local data
            allReviews.forEach(review => {
                review.approved = false;
            });
            
            // Re-apply filters and render
            applyFilters();
            
            showToast('All approvals reset successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to reset approvals');
        }
    } catch (error) {
        console.error('Error resetting approvals:', error);
        showToast('Failed to reset approvals', 'error');
    } finally {
        resetButton.disabled = false;
        resetButton.innerHTML = '<i class="fas fa-undo me-1"></i>Reset All Approvals';
    }
}

function showGoogleApiModal() {
    const modal = new bootstrap.Modal(document.getElementById('googleApiModal'));
    modal.show();
}

async function fetchGoogleReviews() {
    const apiKey = document.getElementById('googleApiKey').value;
    const placeId = document.getElementById('googlePlaceId').value;
    
    if (!apiKey.trim()) {
        showToast('Please enter a Google Places API key', 'error');
        return;
    }
    
    const fetchButton = document.getElementById('fetchGoogleBtn');
    fetchButton.disabled = true;
    fetchButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Fetching...';
    
    try {
        const params = new URLSearchParams({
            api_key: apiKey
        });
        
        if (placeId.trim()) {
            params.append('place_id', placeId.trim());
        }
        
        const response = await fetch(`/api/reviews/google?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('googleApiModal'));
            modal.hide();
            
            // Clear form
            document.getElementById('googleApiKey').value = '';
            document.getElementById('googlePlaceId').value = '';
            
            // Refresh reviews to show Google Reviews
            await refreshReviews();
            
            showToast(`Successfully added ${data.reviews.length} Google Reviews!`, 'success');
        } else {
            throw new Error(data.message || 'Failed to fetch Google Reviews');
        }
    } catch (error) {
        console.error('Error fetching Google Reviews:', error);
        showToast('Failed to fetch Google Reviews. Please check your API key and try again.', 'error');
    } finally {
        fetchButton.disabled = false;
        fetchButton.innerHTML = '<i class="fas fa-download me-1"></i>Fetch Google Reviews';
    }
}

function applyFilters() {
    const ratingFilter = document.getElementById('ratingFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const channelFilter = document.getElementById('channelFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    filteredReviews = allReviews.filter(review => {
        // Rating filter
        if (ratingFilter && review.overall_rating < parseInt(ratingFilter)) {
            return false;
        }
        
        // Category filter
        if (categoryFilter && review.category_ratings) {
            const hasCategory = review.category_ratings.some(cat => 
                cat.category === categoryFilter
            );
            if (!hasCategory) {
                return false;
            }
        }
        
        // Channel filter
        if (channelFilter && review.channel !== channelFilter) {
            return false;
        }
        
        // Date filters
        if (dateFrom || dateTo) {
            const reviewDate = new Date(review.date);
            if (dateFrom && reviewDate < new Date(dateFrom)) {
                return false;
            }
            if (dateTo && reviewDate > new Date(dateTo)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Re-apply current sort
    if (currentSort.column) {
        applySorting();
    }
    
    renderReviews();
}

function clearFilters() {
    document.getElementById('ratingFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('channelFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    
    filteredReviews = [...allReviews];
    
    // Re-apply current sort
    if (currentSort.column) {
        applySorting();
    }
    
    renderReviews();
}

function sortReviews(column) {
    if (currentSort.column === column) {
        // Toggle direction
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New column
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    applySorting();
    renderReviews();
    updateSortIcons();
}

function applySorting() {
    filteredReviews.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        // Handle different data types
        if (currentSort.column === 'date') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else if (currentSort.column === 'overall_rating') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) {
            return currentSort.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
            return currentSort.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

function updateSortIcons() {
    // Reset all sort icons
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort ms-1';
    });
    
    // Update active sort icon
    if (currentSort.column) {
        const activeHeader = document.querySelector(`[data-column="${currentSort.column}"] i`);
        if (activeHeader) {
            activeHeader.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} ms-1`;
        }
    }
}

function refreshReviews() {
    loadReviews();
}

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('reviewsContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showError(message) {
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('reviewsContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Data source indicator function
function updateDataSourceIndicator(reviews) {
    const indicator = document.getElementById('dataSourceIndicator');
    const indicatorText = document.getElementById('dataSourceText');
    
    if (!reviews || reviews.length === 0) {
        if (indicator) indicator.style.display = 'none';
        return;
    }
    
    // Check if any reviews are demo data
    const hasDemoData = reviews.some(review => review.channel === 'Demo');
    const hasRealData = reviews.some(review => review.channel !== 'Demo');
    
    if (!indicator || !indicatorText) return;
    
    if (hasDemoData && !hasRealData) {
        // Only demo data
        indicator.className = 'alert alert-warning mb-0 py-2 px-3';
        indicatorText.innerHTML = 'Showing demo data - Add reviews to your Hostaway account for authentic data';
        indicator.style.display = 'block';
    } else if (hasRealData && !hasDemoData) {
        // Only real data  
        indicator.className = 'alert alert-success mb-0 py-2 px-3';
        indicatorText.innerHTML = 'Showing authentic review data';
        indicator.style.display = 'block';
    } else if (hasDemoData && hasRealData) {
        // Mixed data
        indicator.className = 'alert alert-info mb-0 py-2 px-3';
        indicatorText.innerHTML = 'Showing mix of authentic and demo data';
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    loadReviews();
    
    // Set up event listeners for filters - with error checking
    const ratingFilter = document.getElementById('ratingFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const channelFilter = document.getElementById('channelFilter');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (ratingFilter) ratingFilter.addEventListener('change', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (channelFilter) channelFilter.addEventListener('change', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    // Debug: Check approval status periodically
    setInterval(async function() {
        try {
            const response = await fetch('/api/reviews/status');
            const data = await response.json();
            console.log('Current approval status:', data);
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }, 30000); // Check every 30 seconds
});
