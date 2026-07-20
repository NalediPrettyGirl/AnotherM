const API_BASE_URL = 'https://djangoapi-treasured.onrender.com';
// const API_BASE_URL = 'http://127.0.0.1:8000'; // local testing

// Helper to resolve absolute image URLs for local testing
function resolveImageUrl(url) {
    if (!url) return 'images/intro.png';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${API_BASE_URL}${url}`;
}

// Global state
const storedUserStr = localStorage.getItem('treasured_user');
let parsedUser = null;
try { parsedUser = storedUserStr ? JSON.parse(storedUserStr) : null; } catch(e) {}

const state = {
    user: parsedUser,
    token: parsedUser ? parsedUser.token : null,
};

// Global Fetch Interceptor to auto-inject JWT token for backend API requests
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
    if (state.token && (typeof url === 'string' && url.includes(API_BASE_URL))) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
            if (!options.headers.has('Authorization')) {
                options.headers.set('Authorization', `Bearer ${state.token}`);
            }
        } else {
            if (!options.headers['Authorization']) {
                options.headers['Authorization'] = `Bearer ${state.token}`;
            }
        }
    }
    return originalFetch(url, options);
};

// Generic fetch function
async function apiFetch(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            if (response.status === 404) return null;
            const errorText = await response.text();
            let errorMsg = `API error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        console.error('API Fetch Error:', error);
        return null;
    }
}

// Pagination State
let currentCategoryProducts = [];
let currentCategoryPage = 1;
const ITEMS_PER_PAGE = 12;

// Function to load products into category page
async function loadCategoryProducts(filters = {}) {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    const urlParams = new URLSearchParams(window.location.search);
    const categoryType = urlParams.get('type');
    
    grid.innerHTML = '<p class="text-center w-100">Loading products...</p>';
    let products = await apiFetch('/products');
    
    if (!products || products.length === 0) {
        grid.innerHTML = '<p class="text-center w-100">No products found. Start selling!</p>';
        return;
    }

    // Filter by category if specified in URL
    if (categoryType) {
        products = products.filter(p => {
            if (!p.category) return false;
            const cat = p.category.toLowerCase();
            if (categoryType === 'wedding') return cat.includes('wedding');
            if (categoryType === 'evening') return cat.includes('evening') || cat.includes('matric');
            if (categoryType === 'men') return cat.includes('men');
            if (categoryType === 'kiddos') return cat.includes('kid') || cat.includes('flower') || cat.includes('page');
            return true;
        });
    }

    // Apply sidebar filters
    if (filters.priceRanges && filters.priceRanges.length > 0) {
        products = products.filter(p => {
            const price = parseFloat(p.price);
            return filters.priceRanges.some(range => {
                const [min, max] = range.split('-').map(v => v === 'plus' ? Infinity : parseFloat(v));
                return price >= min && price <= max;
            });
        });
    }

    if (filters.sizes && filters.sizes.length > 0) {
        products = products.filter(p => {
            if (!p.size) return false;
            const sizeStr = p.size.toString().toUpperCase();
            return filters.sizes.some(s => {
                if (s === 'XS-S') {
                    return sizeStr.includes('30') || sizeStr.includes('32') || sizeStr.includes('XS') || sizeStr.includes('S');
                }
                if (s === 'M-L') {
                    return sizeStr.includes('34') || sizeStr.includes('36') || sizeStr.includes('38') || sizeStr.includes('M') || sizeStr.includes('L');
                }
                if (s === 'XL-XXXL') {
                    return sizeStr.includes('40') || sizeStr.includes('XL') || sizeStr.includes('XXL') || sizeStr.includes('XXXL');
                }
                return false;
            });
        });
    }

    if (filters.provinces && filters.provinces.length > 0) {
        products = products.filter(p => {
            if (!p.province) return false;
            const prov = p.province.toLowerCase().trim();
            return filters.provinces.some(f => f.toLowerCase().trim() === prov);
        });
    }

    if (filters.conditions && filters.conditions.length > 0) {
        products = products.filter(p => {
            if (!p.condition) return false;
            const cond = p.condition.toLowerCase().trim();
            return filters.conditions.some(c => {
                const searchCond = c.toLowerCase().trim();
                if (searchCond === 'new-never worn' && cond.includes('new')) return true;
                if (searchCond === 'pre-loved' && cond.includes('love')) return true;
                return cond === searchCond;
            });
        });
    }

    if (products.length === 0) {
        grid.innerHTML = `<p class="text-center w-100">No products found matching your criteria.</p>`;
        const paginationWrapper = document.getElementById('pagination-wrapper');
        if (paginationWrapper) paginationWrapper.style.display = 'none';
        return;
    }

    currentCategoryProducts = products;
    renderCategoryPage(1);
}

// Function to render a specific page of category products
function renderCategoryPage(page) {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    currentCategoryPage = page;
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageProducts = currentCategoryProducts.slice(startIndex, endIndex);

    grid.innerHTML = '';
    pageProducts.forEach(product => {
        const productHtml = `
            <div class="outfit-card category-card">
                <div class="outfit-image-container">
                    <img src="${resolveImageUrl(product.imageUrl)}" alt="${product.title}" style="width:120px;height:120px;object-fit:contain;">
                </div>
                <div class="outfit-details">
                    <p class="outfit-desc" style="font-size:13px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${product.description || product.title}">${product.title}</p>
                    <h3 class="outfit-price">R${product.price}</h3>
                    <a href="product-details.html?id=${product.id}" class="btn-outline-gold w-100 mt-2 mb-2 p-2" style="border-radius:30px;">View</a>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });

    updatePaginationUI();
    
    // Auto-scroll to top of grid
    window.scrollTo({ top: grid.offsetTop - 150, behavior: 'smooth' });
}

function updatePaginationUI() {
    const wrapper = document.getElementById('pagination-wrapper');
    const numbersContainer = document.getElementById('pagination-numbers');
    if (!wrapper || !numbersContainer) return;

    const totalPages = Math.ceil(currentCategoryProducts.length / ITEMS_PER_PAGE);
    
    if (totalPages <= 1) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'flex';
    numbersContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentCategoryPage ? 'active' : '';
        const pageHtml = `
            <div class="page-num ${isActive}" onclick="renderCategoryPage(${i})" style="cursor:pointer;">
                <div class="page-dot" ${isActive ? '' : 'style="opacity: 0;"'}></div>
                <span class="page-text">${i}</span>
            </div>
        `;
        numbersContainer.innerHTML += pageHtml;
    }

    const prevBtn = document.getElementById('page-prev-btn');
    const nextBtn = document.getElementById('page-next-btn');

    prevBtn.onclick = () => {
        if (currentCategoryPage > 1) renderCategoryPage(currentCategoryPage - 1);
    };
    nextBtn.onclick = () => {
        if (currentCategoryPage < totalPages) renderCategoryPage(currentCategoryPage + 1);
    };
    
    prevBtn.style.opacity = currentCategoryPage === 1 ? '0.5' : '1';
    prevBtn.style.cursor = currentCategoryPage === 1 ? 'not-allowed' : 'pointer';
    
    nextBtn.style.opacity = currentCategoryPage === totalPages ? '0.5' : '1';
    nextBtn.style.cursor = currentCategoryPage === totalPages ? 'not-allowed' : 'pointer';
}

// Function to setup sidebar filters
function setupFilters() {
    const searchBtn = document.querySelector('.btn-search');
    if (!searchBtn) return;

    searchBtn.addEventListener('click', () => {
        const filters = {
            priceRanges: [],
            sizes: [],
            provinces: [],
            conditions: []
        };

        // Price mapping
        if (document.getElementById('price1').checked) filters.priceRanges.push('0-3000');
        if (document.getElementById('price2').checked) filters.priceRanges.push('3000-5000');
        if (document.getElementById('price3').checked) filters.priceRanges.push('6000-9000');
        if (document.getElementById('price4').checked) filters.priceRanges.push('9000-12000');
        if (document.getElementById('price5').checked) filters.priceRanges.push('12000-15000');
        if (document.getElementById('price6').checked) filters.priceRanges.push('15000-25000');

        // Size mapping
        if (document.getElementById('size1').checked) filters.sizes.push('XS-S');
        if (document.getElementById('size2').checked) filters.sizes.push('M-L');
        if (document.getElementById('size3').checked) filters.sizes.push('XL-XXXL');

        // Province mapping
        const provinceGroup = Array.from(document.querySelectorAll('.filter-group')).find(g => g.querySelector('h4') && g.querySelector('h4').innerText.trim() === 'Province');
        if (provinceGroup) {
            const provinceChecks = provinceGroup.querySelectorAll('input:checked');
            provinceChecks.forEach(ch => {
                const label = provinceGroup.querySelector(`label[for="${ch.id}"]`);
                if (label) filters.provinces.push(label.innerText.trim());
            });
        }

        // Condition mapping
        if (document.getElementById('cond1').checked) filters.conditions.push('New-Never Worn');
        if (document.getElementById('cond2').checked) filters.conditions.push('Pre-Loved');

        loadCategoryProducts(filters);
    });
}

// Function to load dashboard stats
async function loadDashboardStats() {
    const publishedEl = document.querySelector('.stat-card-dash:nth-child(1) h2');
    const pendingEl = document.querySelector('.stat-card-dash:nth-child(2) h2');
    if (!publishedEl || !pendingEl) return;

    // Load actual total products and filter for the active user
    const products = await apiFetch('/products');
    if (products && state.user) {
        const myProducts = products.filter(p => p.sellerId === state.user.id);
        publishedEl.innerText = myProducts.length;
        // Mocking 'pending' interactions based on actual listings count
        pendingEl.innerText = Math.floor(myProducts.length / 2);

        // Smart Dashboard Logic (Buyer vs Seller View)
        const dashboardTab = document.querySelector('.sidebar-link[data-target="dashboard"]');
        const listingsTab = document.querySelector('.sidebar-link[data-target="listings"]');
        const bookmarksTab = document.querySelector('.sidebar-link[data-target="bookmarks"]');
        const buyerCta = document.getElementById('buyer-cta-container');

        if (myProducts.length === 0) {
            // Pure Buyer Mode: Hide seller stats and listings
            if (dashboardTab) dashboardTab.closest('.sidebar-item').style.display = 'none';
            if (listingsTab) listingsTab.closest('.sidebar-item').style.display = 'none';
            if (buyerCta) buyerCta.style.display = 'block';

            // Auto-switch to Bookmarks
            if (dashboardTab && dashboardTab.classList.contains('active')) {
                dashboardTab.classList.remove('active');
                if (bookmarksTab) bookmarksTab.click(); 
            }
        } else {
            // Seller Mode: Show everything
            if (dashboardTab) dashboardTab.closest('.sidebar-item').style.display = 'block';
            if (listingsTab) listingsTab.closest('.sidebar-item').style.display = 'block';
            if (buyerCta) buyerCta.style.display = 'none';
        }
    }
}

// Function to load dashboard account details
async function loadDashboardAccount() {
    if (!state.user) return;
    const fnameInput = document.getElementById('dash-fname');
    const lnameInput = document.getElementById('dash-lname');
    const emailInput = document.getElementById('dash-email');
    const phoneInput = document.getElementById('dash-phone');
    
    if (fnameInput) fnameInput.value = state.user.name || state.user.username || '';
    if (lnameInput) lnameInput.value = state.user.surname || '';
    if (emailInput) emailInput.value = state.user.email || '';
    if (phoneInput) {
        let wa = state.user.whatsapp || '';
        const ccSelect = document.getElementById('dash-country-code');
        if (ccSelect && wa.startsWith('+')) {
            const options = Array.from(ccSelect.options).map(o => o.value).sort((a,b) => b.length - a.length);
            const matchedCode = options.find(c => wa.startsWith(c));
            if (matchedCode) {
                ccSelect.value = matchedCode;
                phoneInput.value = wa.substring(matchedCode.length);
            } else {
                phoneInput.value = wa;
            }
        } else {
            phoneInput.value = wa;
        }
    }

    const form = document.getElementById('dash-account-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fname = document.getElementById('dash-fname').value.trim();
            const lname = document.getElementById('dash-lname').value.trim();
            const email = document.getElementById('dash-email').value.trim();
            const whatsapp = document.getElementById('dash-phone').value.trim();
            const currPw = document.getElementById('dash-curr-pw').value;
            const newPw = document.getElementById('dash-new-pw').value;
            
            if (fname.length < 2 || lname.length < 2) {
                return alert('Name and surname must be at least 2 characters.');
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return alert('Please enter a valid email address.');
            }
            const countryCodeSelect = document.getElementById('dash-country-code');
            const countryCode = countryCodeSelect ? countryCodeSelect.value : '+27';
            
            let rawPhone = whatsapp.replace(/^0+/, '');
            rawPhone = rawPhone.replace(/[\s\-\(\)]/g, '');
            const finalWhatsapp = countryCode + rawPhone;

            if (whatsapp && !/^\+[1-9]\d{6,14}$/.test(finalWhatsapp)) {
                return alert('Please enter a valid phone number (between 7 and 15 digits).');
            }

            const updatedData = {
                name: fname,
                surname: lname,
                email: email,
                whatsapp: finalWhatsapp,
            };

            if (newPw) {
                if (!currPw) {
                    return alert('Current password is required to change password.');
                }
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
                if (!passwordRegex.test(newPw)) {
                    return alert('New password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number.');
                }
                updatedData.currentPassword = currPw;
                updatedData.newPassword = newPw;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/users/${state.user.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                if (response.ok) {
                    const saved = await response.json();
                    state.user = { ...state.user, ...saved };
                    localStorage.setItem('treasured_user', JSON.stringify(state.user));
                    document.getElementById('dash-curr-pw').value = '';
                    document.getElementById('dash-new-pw').value = '';
                    alert('Profile updated successfully!');
                } else {
                    state.user = { ...state.user, ...updatedData };
                    localStorage.setItem('treasured_user', JSON.stringify(state.user));
                    alert('Profile updated locally (backend might not support PUT yet).');
                }
            } catch (err) {
                state.user = { ...state.user, ...updatedData };
                localStorage.setItem('treasured_user', JSON.stringify(state.user));
                alert('Profile updated locally.');
            }
            
            // update UI names
            const userDisplays = document.querySelectorAll('.user-name-dropdown span, .top-bar-item.sign-in span, .greeting-title-dash');
            userDisplays.forEach(el => {
                if (el.classList.contains('greeting-title-dash')) {
                    el.innerText = `Hello, ${state.user.name || state.user.username}!`;
                } else {
                    el.innerText = state.user.name || state.user.username;
                }
            });
        });
    }
}

// Function to load dashboard listings
async function loadDashboardListings() {
    const grid = document.getElementById('dashboard-listings-grid');
    if (!grid || !state.user) return;

    grid.innerHTML = '<p class="text-center w-100">Loading your listings...</p>';
    const products = await apiFetch('/products');
    if (!products) {
        grid.innerHTML = '<p class="text-center w-100">Failed to load listings.</p>';
        return;
    }
    
    const myProducts = products.filter(p => p.sellerId === state.user.id);
    if (myProducts.length === 0) {
        grid.innerHTML = '<p class="text-center w-100 py-4">You have no active listings. Start selling today!</p>';
        return;
    }

    grid.innerHTML = '';
    myProducts.forEach((product, idx) => {
        const status = product.status || 'pending';
        let badgeColor = 'bg-warning text-dark';
        let badgeText = 'Pending';
        if (status === 'approved') {
            badgeColor = 'bg-success';
            badgeText = 'Active';
        } else if (status === 'rejected') {
            badgeColor = 'bg-danger';
            badgeText = 'Rejected';
        }
        
        const productHtml = `
            <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="bg-white d-flex flex-column h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
                    <span class="badge ${badgeColor} position-absolute top-0 end-0 m-3 z-3">${badgeText}</span>
                    <div style="height: 200px; overflow: hidden; background-color: #f8f9fa;">
                        ${product.imageUrl ? `<img src="${resolveImageUrl(product.imageUrl)}" class="w-100 h-100 object-fit-cover" alt="Listing Image">` : `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-muted"><i class="fa-solid fa-image fa-3x"></i></div>`}
                    </div>
                    <div class="flex-grow-1 p-3">
                        <h5 class="card-title" style="font-family: 'Playfair Display', serif; color: var(--sage-green); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1.1rem;" title="${product.title}">${product.title}</h5>
                        <p class="card-text text-muted small mb-3">Listed recently</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold" style="color: var(--gold); font-size: 18px;">R ${product.price}</span>
                            <div>
                                <button class="btn btn-sm btn-outline-secondary me-2 rounded-circle" style="width: 32px; height: 32px; padding: 0;"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-sm btn-outline-danger rounded-circle" style="width: 32px; height: 32px; padding: 0;" onclick="deleteDashboardListing('${product.id}')"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });
}

window.deleteDashboardListing = async function(id) {
    if (confirm('Are you sure you want to delete this listing?')) {
        try {
            await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
            loadDashboardListings();
            loadDashboardStats();
        } catch(e) {
            alert('Failed to delete listing.');
        }
    }
}

// Function to load dashboard bookmarks
async function loadDashboardBookmarks() {
    const grid = document.getElementById('dashboard-bookmarks-grid');
    if (!grid) return;

    const favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
    if (favorites.length === 0) {
        grid.innerHTML = '<p class="text-center w-100 py-5">You haven\'t saved any items yet.</p>';
        return;
    }

    grid.innerHTML = '<p class="text-center w-100">Loading your saved items...</p>';
    
    const productPromises = favorites.map(id => apiFetch(`/products/${id}`));
    const products = (await Promise.all(productPromises)).filter(p => p !== null);

    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center w-100 py-5">Your saved items are no longer available.</p>';
        return;
    }

    grid.innerHTML = '';
    products.forEach(product => {
        const productHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="bg-white d-flex flex-column h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
                    <button class="btn btn-light rounded-circle position-absolute top-0 end-0 m-3 z-3 shadow-sm text-danger" style="width: 36px; height: 36px; padding: 0;" onclick="removeFromDashboardFavorites('${product.id}')">
                        <i class="fa-solid fa-heart"></i>
                    </button>
                    <div style="height: 250px; overflow: hidden; background-color: #f8f9fa;">
                        ${product.imageUrl ? `<img src="${resolveImageUrl(product.imageUrl)}" class="w-100 h-100 object-fit-cover" alt="Bookmark Image">` : `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-muted"><i class="fa-solid fa-image fa-3x"></i></div>`}
                    </div>
                    <div class="flex-grow-1 p-4">
                        <span class="badge mb-2" style="background-color: var(--cream); color: var(--sage-green);">${product.category || 'Attire'}</span>
                        <h5 class="card-title" style="font-family: 'Playfair Display', serif; color: var(--sage-green); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${product.title}">${product.title}</h5>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="fw-bold" style="color: var(--gold); font-size: 18px;">R ${product.price}</span>
                            <a href="product-details.html?id=${product.id}" class="text-decoration-none" style="color: var(--sage-green); font-weight: 500; font-size: 14px;">View Details <i class="fa-solid fa-arrow-right ms-1"></i></a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });
}

window.removeFromDashboardFavorites = function(productId) {
    let favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
    favorites = favorites.filter(id => id !== productId);
    localStorage.setItem('treasured_favorites', JSON.stringify(favorites));
    loadDashboardBookmarks();
};

// Function to handle login
window.handleLogin = function() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById('loginUsername') || form.querySelectorAll('input')[0];
            const passwordInput = document.getElementById('loginPassword') || form.querySelectorAll('input')[1];
            
            if (!usernameInput || !passwordInput) return; // Not the login form
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const errorBox = document.getElementById('loginError');
            const errorMsg = document.getElementById('loginErrorMsg');

            const showError = (msg) => {
                if (errorBox && errorMsg) {
                    errorMsg.textContent = msg;
                    errorBox.style.display = 'flex';
                    form.classList.add('shake');
                    setTimeout(() => form.classList.remove('shake'), 500);
                } else {
                    alert(msg);
                }
            };

            if (username.length < 3) {
                return showError('Username must be at least 3 characters long.');
            }
            if (password.length < 6) {
                return showError('Password must be at least 6 characters long.');
            }
            if (errorBox) errorBox.style.display = 'none';

            try {
                const response = await fetch(`${API_BASE_URL}/users/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('treasured_user', JSON.stringify(data));
                    window.location.href = 'dashboard.html';
                } else {
                    const errorData = await response.json().catch(() => ({ error: 'Invalid username or password' }));
                    showError(errorData.error || 'Invalid username or password');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Failed to connect to the server. Please ensure the backend is running.');
            }
        });
    });
};

// Function to handle register
function handleRegister() {
    const form = document.getElementById('userRegisterForm') || document.querySelector('.auth-form');
    if (!form || !window.location.href.includes('register.html')) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = form.querySelectorAll('input');
        
        const name = (document.getElementById('regName') || inputs[0]).value.trim();
        const surname = (document.getElementById('regSurname') || inputs[1]).value.trim();
        const whatsapp = (document.getElementById('regPhone') || inputs[2]).value.trim();
        const email = (document.getElementById('regEmail') || inputs[3]).value.trim();
        const username = (document.getElementById('regUsername') || inputs[4]).value.trim();
        const password = (document.getElementById('regPassword') || inputs[5]).value;

        const errorBox = document.getElementById('registerError');
        const errorMsg = document.getElementById('registerErrorMsg');

        const showError = (msg) => {
            if (errorBox && errorMsg) {
                errorMsg.textContent = msg;
                errorBox.style.display = 'flex';
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            } else {
                alert(msg);
            }
        };

        if (name.length < 2 || surname.length < 2) {
            return showError('Name and surname must be at least 2 characters long.');
        }
        
        const countryCodeSelect = document.getElementById('regCountryCode');
        const countryCode = countryCodeSelect ? countryCodeSelect.value : '+27';
        
        // Remove any leading zeroes from the typed phone number
        let rawPhone = whatsapp.replace(/^0+/, '');
        // Remove spaces, hyphens, parentheses
        rawPhone = rawPhone.replace(/[\s\-\(\)]/g, '');
        
        const formattedWhatsapp = countryCode + rawPhone;

        if (!/^\+[1-9]\d{6,14}$/.test(formattedWhatsapp)) {
            return showError('Please enter a valid phone number (between 7 and 15 digits).');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return showError('Please enter a valid email address.');
        }
        if (username.length < 3) {
            return showError('Username must be at least 3 characters long.');
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (password.length < 6 || !passwordRegex.test(password)) {
            return showError('Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number.');
        }
        if (errorBox) errorBox.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, surname, whatsapp: formattedWhatsapp, email, username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('treasured_user', JSON.stringify(data));
                window.location.href = 'dashboard.html';
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
                showError(errorData.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Failed to connect to the server. Please ensure the backend is running.');
        }
    });
}

// Function to handle vendor register
function handleVendorRegister() {
    const form = document.getElementById('vendorRegisterForm');
    if (!form || !window.location.href.includes('vendor-register.html')) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = form.querySelectorAll('input');
        
        const name = (document.getElementById('regName') || inputs[0]).value.trim();
        const surname = (document.getElementById('regSurname') || inputs[1]).value.trim();
        const whatsapp = (document.getElementById('regPhone') || inputs[2]).value.trim();
        const email = (document.getElementById('regEmail') || inputs[3]).value.trim();
        const username = (document.getElementById('regUsername') || inputs[4]).value.trim();
        const password = (document.getElementById('regPassword') || inputs[5]).value;

        const errorBox = document.getElementById('registerError');
        const errorMsg = document.getElementById('registerErrorMsg');

        const showError = (msg) => {
            if (errorBox && errorMsg) {
                errorMsg.textContent = msg;
                errorBox.style.display = 'flex';
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            } else {
                alert(msg);
            }
        };

        if (name.length < 2 || surname.length < 2) return showError('Name and surname must be at least 2 characters long.');
        
        const countryCodeSelect = document.getElementById('regCountryCode');
        const countryCode = countryCodeSelect ? countryCodeSelect.value : '+27';
        let rawPhone = whatsapp.replace(/^0+/, '').replace(/[\s\-\(\)]/g, '');
        const formattedWhatsapp = countryCode + rawPhone;

        if (!/^\+[1-9]\d{6,14}$/.test(formattedWhatsapp)) return showError('Please enter a valid phone number (between 7 and 15 digits).');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Please enter a valid email address.');
        if (username.length < 3) return showError('Username must be at least 3 characters long.');
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (password.length < 6 || !passwordRegex.test(password)) {
            return showError('Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number.');
        }
        if (errorBox) errorBox.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, surname, whatsapp: formattedWhatsapp, email, username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('treasured_user', JSON.stringify(data));
                window.location.href = 'list-service.html'; // Go directly to list-service!
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
                showError(errorData.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Failed to connect to the server.');
        }
    });
}

// Image upload handling logic
function setupImageUploads() {
    const mainInput = document.getElementById('main-images');
    const mainPreview = document.getElementById('main-image-preview');
    const extraInput = document.getElementById('extra-images');
    const extraPreview = document.getElementById('extra-image-preview');

    function handleFileSelect(input, previewContainer, maxFiles, globalStoreKey) {
        if (!input || !previewContainer) return;
        window[globalStoreKey] = [];
        
        input.addEventListener('change', function(e) {
            previewContainer.innerHTML = '';
            window[globalStoreKey] = []; // clear on re-selection
            const files = Array.from(e.target.files).slice(0, maxFiles);
            
            files.forEach(file => {
                if (!file.type.startsWith('image/')) return;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    window[globalStoreKey].push(e.target.result); // store the base64 result
                    
                    const imgContainer = document.createElement('div');
                    imgContainer.style.width = '80px';
                    imgContainer.style.height = '80px';
                    imgContainer.style.borderRadius = '4px';
                    imgContainer.style.overflow = 'hidden';
                    imgContainer.style.border = '1px solid #ddd';
                    
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    
                    imgContainer.appendChild(img);
                    previewContainer.appendChild(imgContainer);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    handleFileSelect(mainInput, mainPreview, 4, 'collectedMainImages');
    handleFileSelect(extraInput, extraPreview, 4, 'collectedExtraImages');
}

// Function to handle attire listing
function handleListAttire() {
    setupImageUploads();
    
    const form = document.getElementById('listing-form');
    if (!form) return;

    if (!state.user) {
        window.location.href = 'login.html';
        return;
    }

    // Set up payment method buttons click handlers
    const methodBtns = document.querySelectorAll('.payment-method-btn');
    methodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            methodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const selectedMethod = btn.dataset.method;
            const detailContainers = document.querySelectorAll('.payment-method-details');
            detailContainers.forEach(container => container.classList.add('d-none'));
            
            const targetContainer = document.getElementById(`payment-details-${selectedMethod}`);
            if (targetContainer) targetContainer.classList.remove('d-none');
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Processing Payment...';
        }
        
        // Extract the form data
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (key === 'main_images' || key === 'extra_images') continue;
            
            if (data.hasOwnProperty(key)) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                if (key === 'style') {
                    data[key] = [value];
                } else {
                    data[key] = value;
                }
            }
        }
        
        if (!data.title || data.title.trim().length < 3) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Pay & Submit Listing'; }
            return alert('Title must be at least 3 characters long.');
        }
        if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Pay & Submit Listing'; }
            return alert('Please enter a valid price greater than 0.');
        }
        if (!data.category) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Pay & Submit Listing'; }
            return alert('Please select a category.');
        }
        // Upload images first using the new secure endpoint
        const mainInput = document.getElementById('main-images');
        const extraInput = document.getElementById('extra-images');
        
        const uploadForm = new FormData();
        
        if (mainInput && mainInput.files) {
            Array.from(mainInput.files).slice(0, 4).forEach(file => {
                uploadForm.append('main_images', file);
            });
        }
        
        if (extraInput && extraInput.files) {
            Array.from(extraInput.files).slice(0, 4).forEach(file => {
                uploadForm.append('extra_images', file);
            });
        }
        
        try {
            const uploadRes = await fetch(`${API_BASE_URL}/products/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`
                },
                body: uploadForm
            });
            
            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Pay & Submit Listing'; }
                return alert(errData.error || 'Failed to upload images. Please check the file sizes and types.');
            }
            
            const uploadedPaths = await uploadRes.json();
            data.main_images = uploadedPaths.main_images || [];
            data.extra_images = uploadedPaths.extra_images || [];
            if(data.main_images.length > 0) {
                data.imageUrl = data.main_images[0];
            }
        } catch(e) {
            console.log('API upload failed, mocking success for local testing.');
            data.main_images = window['collectedMainImages'] || [];
            data.extra_images = window['collectedExtraImages'] || [];
            if(data.main_images.length > 0) data.imageUrl = data.main_images[0];
        }
        
        data.sellerId = state.user.id;
        
        // Trigger Yoco Payment using our backend endpoint
        try {
            // Save the draft listing so we can publish it when we return from Yoco
            localStorage.setItem('treasured_pending_listing', JSON.stringify(data));
            
            // Yoco will crash if the origin is a local file:// URL. Let's ensure it's a valid http URL.
            let origin = window.location.origin;
            if (!origin || origin === 'null' || origin.includes('file://')) {
                origin = 'http://localhost:3000'; // Route back to our Express server
            }
            
            const response = await fetch(`${API_BASE_URL}/checkout/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    amount: 4900, // R49.00 in Cents
                    currency: 'ZAR',
                    successUrl: origin + '/dashboard.html?payment=success',
                    cancelUrl: origin + '/list-attire.html?payment=cancel'
                })
            });
            
            const checkoutData = await response.json();
            
            if (checkoutData.redirectUrl) {
                // Redirect the user to Yoco's Secure Payment Page!
                window.location.href = checkoutData.redirectUrl;
            } else {
                alert(checkoutData.error || 'Failed to initialize payment.');
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = 'Publish Listing';
                }
            }
        } catch (err) {
            console.error('Checkout error:', err);
            // Mock payment success for local testing
            alert('Mock Payment Successful (Offline Mode). Your listing will now be published!');
            window.location.href = 'dashboard.html?payment=success';
        }
    });
}

// Function to handle service listing (FREE)
function handleListService() {
    setupImageUploads();
    
    const form = document.getElementById('service-listing-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!state.user) {
            alert('Please login or register as a vendor first.');
            window.location.href = 'vendor-register.html';
            return;
        }

        const confirmBtn = document.getElementById('submit-listing-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Publishing...';
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (!data.title || data.title.trim().length < 3) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Publish Service Listing'; }
            return alert('Title must be at least 3 characters long.');
        }
        if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Publish Service Listing'; }
            return alert('Please enter a valid price greater than 0.');
        }
        if (!data.category || !data.subCategory) {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Publish Service Listing'; }
            return alert('Please select a category and sub-category.');
        }

        // Upload images first
        const mainInput = document.getElementById('main-images');
        const extraInput = document.getElementById('extra-images');
        
        const uploadForm = new FormData();
        
        if (mainInput && mainInput.files) {
            Array.from(mainInput.files).slice(0, 4).forEach(file => {
                uploadForm.append('main_images', file);
            });
        }
        if (extraInput && extraInput.files) {
            Array.from(extraInput.files).slice(0, 4).forEach(file => {
                uploadForm.append('extra_images', file);
            });
        }
        
        try {
            const uploadRes = await fetch(`${API_BASE_URL}/products/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${state.token}` },
                body: uploadForm
            });
            
            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Publish Service Listing'; }
                return alert(errData.error || 'Failed to upload images.');
            }
            
            const uploadedPaths = await uploadRes.json();
            data.main_images = uploadedPaths.main_images || [];
            data.extra_images = uploadedPaths.extra_images || [];
            if(data.main_images.length > 0) data.imageUrl = data.main_images[0];
        } catch(e) {
            console.log('API upload failed, mocking success for local testing.');
            data.main_images = window['collectedMainImages'] || [];
            data.extra_images = window['collectedExtraImages'] || [];
            if(data.main_images.length > 0) data.imageUrl = data.main_images[0];
        }
        
        data.sellerId = state.user.id;
        data.status = 'published'; // Free, so it's instantly published!
        
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('Your Service Listing has been successfully published!');
                window.location.href = 'dashboard.html';
            } else {
                const errData = await response.json();
                alert(errData.error || 'Failed to create listing.');
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Publish Service Listing'; }
            }
        } catch (err) {
            console.error('Publish error:', err);
            alert('Mock Publish Successful (Offline Mode).');
            window.location.href = 'dashboard.html';
        }
    });
}

// Intercept "List Your Attire" and "Sell My Outfit" clicks site-wide
function setupListAttireButtons() {
    const listBtns = Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        return (href === 'login.html' && (a.classList.contains('btn-outline-white') || a.classList.contains('btn-outline-gold'))) ||
               (href === 'pricing.html' && a.classList.contains('btn-list-attire')) ||
               a.classList.contains('btn-list-attire') ||
               a.classList.contains('btn-list-attire-dash');
    });

    listBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Take everyone to the pricing terms page first!
            window.location.href = 'pricing.html';
        });
    });
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Top bar profile updates
    window.logoutUser = function(e) {
        if (e) e.preventDefault();
        localStorage.removeItem('treasured_user');
        localStorage.removeItem('treasured_token');
        window.location.href = 'index.html';
    };

    const userStr = localStorage.getItem('treasured_user');
    const topBarRight = document.querySelector('.top-bar-right');
    
    if (userStr) {
        try {
            state.user = JSON.parse(userStr);
            const userName = state.user.name || state.user.username;
            
            // Update dashboard title if it exists
            const dashTitle = document.querySelector('.greeting-title-dash');
            if (dashTitle) dashTitle.innerText = `Hello, ${userName}!`;
            
            // Inject the dropdown HTML for all pages
            if (topBarRight) {
                topBarRight.innerHTML = `
                    <div class="user-profile-nav" style="display: flex; align-items: center; gap: 15px;">
                        <div class="dropdown">
                            <button class="user-name-dropdown dropdown-toggle border-0 bg-transparent p-0" type="button" id="profileDropdown" data-bs-toggle="dropdown" aria-expanded="false" style="color: var(--dark-grey); font-size: 14px; font-weight: 500;">
                                <span>${userName}</span>
                                <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--gold); margin-left: 5px;"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2" aria-labelledby="profileDropdown">
                                <li><a class="dropdown-item py-2 px-4" href="dashboard.html"><i class="fa-regular fa-user me-2"></i> My Profile</a></li>
                                <li><a class="dropdown-item py-2 px-4" href="dashboard.html"><i class="fa-solid fa-gear me-2"></i> Settings</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item py-2 px-4 text-danger" href="#" onclick="logoutUser(event)"><i class="fa-solid fa-arrow-right-from-bracket me-2"></i> Logout</a></li>
                            </ul>
                        </div>
                        <i class="fa-regular fa-user" style="font-size: 18px; color: var(--gold);"></i>
                        <div class="notifications-container" id="nav-notifications-bell" style="display: inline-block; position: relative;">
                            <i class="fa-regular fa-bell notification-bell" style="font-size: 18px; color: var(--gold); cursor: pointer;"></i>
                            <span class="notification-badge" id="nav-notifications-badge">0</span>
                            <div class="notification-dropdown" id="nav-notifications-dropdown">
                                <div class="notification-empty">Loading notifications...</div>
                            </div>
                        </div>
                        <a href="favorites.html" class="text-decoration-none text-reset"><i class="fa-regular fa-heart" style="font-size: 18px; color: var(--gold); cursor: pointer;" title="Favorites"></i></a>
                    </div>
                `;
            }
            
            // Load notifications
            setTimeout(loadNotifications, 500);
            
        } catch (e) {}
    } else {
        if (topBarRight) {
            topBarRight.innerHTML = `
                <div class="top-bar-item sign-in" style="display: flex; align-items: center; gap: 10px;">
                    <a href="login.html" class="text-decoration-none text-reset" style="color: var(--dark-grey); font-size: 14px; font-weight: 500;"><span>Sign In / Register</span></a>
                    <i class="fa-regular fa-user" style="font-size: 18px; color: var(--gold);"></i>
                </div>
                <div class="top-bar-item favorites" style="cursor: pointer; display: flex; align-items: center;" title="Favorites">
                    <a href="favorites.html" class="text-decoration-none text-reset"><i class="fa-regular fa-heart" style="font-size: 18px; color: var(--gold);"></i></a>
                </div>
            `;
            // Re-apply standard layout gap if we replaced it
            topBarRight.style.display = 'flex';
            topBarRight.style.gap = '20px';
        }
    }

    setupListAttireButtons();

    // Set up toggle for the notification dropdown
    document.addEventListener('click', (e) => {
        const bell = document.getElementById('nav-notifications-bell');
        const dropdown = document.getElementById('nav-notifications-dropdown');
        if (bell && dropdown) {
            if (e.target.closest('.notification-bell') || e.target.closest('#nav-notifications-badge')) {
                dropdown.classList.toggle('show');
                if (dropdown.classList.contains('show')) {
                    markNotificationsAsRead();
                }
            } else if (!e.target.closest('.notification-dropdown')) {
                dropdown.classList.remove('show');
            }
        }
    });

    if (window.location.pathname.includes('category.html')) {
        loadCategoryProducts();
        setupFilters();
    } else if (window.location.pathname.includes('dashboard.html')) {
        if (!state.user) {
            // Redirect to login if accessing dashboard anonymously
            window.location.href = 'login.html';
            return;
        }
        loadDashboardStats();
        loadDashboardAccount();
        loadDashboardListings();
        loadDashboardBookmarks();
        loadDashboardChats();
        
        // Check if we just returned from a successful Yoco payment
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            const pendingListingStr = localStorage.getItem('treasured_pending_listing');
            if (pendingListingStr) {
                try {
                    const data = JSON.parse(pendingListingStr);
                    fetch(`${API_BASE_URL}/products`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify(data)
                    }).then(res => {
                        if (res.ok) {
                            alert('Payment successful! Your listing is now published.');
                            localStorage.removeItem('treasured_pending_listing');
                            loadDashboardStats();
                            loadDashboardListings();
                        } else {
                            throw new Error('Failed');
                        }
                    }).catch(e => {
                        console.log('Mock Publish successful (Offline mode).');
                        localStorage.removeItem('treasured_pending_listing');
                        loadDashboardStats();
                        loadDashboardListings();
                    });
                } catch (e) {
                    console.error("Error publishing pending listing", e);
                }
            }
        }
        
        // Setup dashboard sidebar tab switching
        const sidebarLinks = document.querySelectorAll('.sidebar-link:not(.danger)');
        const contentSections = document.querySelectorAll('.dashboard-section-content');
        
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('data-target');
                if(!targetId) return;
                
                e.preventDefault();
                
                // Update active link
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Show target section, hide others
                contentSections.forEach(section => {
                    if(section.id === `section-${targetId}`) {
                        section.style.display = 'block';
                    } else {
                        section.style.display = 'none';
                    }
                });
            });
        });
        
        // Setup logout block
        const logoutLinks = document.querySelectorAll('.sidebar-link.danger, .dropdown-item.text-danger');
        logoutLinks.forEach(link => {
            if (link.innerText.toUpperCase().includes('LOGOUT')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const logoutModalEl = document.getElementById('logoutModal');
                    if (logoutModalEl) {
                        const modal = new bootstrap.Modal(logoutModalEl);
                        const confirmBtn = document.getElementById('confirm-logout-btn');
                        confirmBtn.onclick = () => {
                            localStorage.removeItem('treasured_user');
                            window.location.href = 'index.html';
                        };
                        modal.show();
                    } else {
                        if (confirm('Are you sure you want to log out?')) {
                            localStorage.removeItem('treasured_user');
                            window.location.href = 'index.html';
                        }
                    }
                });
            } else if (link.innerText.toUpperCase().includes('DELETE ACCOUNT')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const deleteModalEl = document.getElementById('deleteAccountModal');
                    if (deleteModalEl) {
                        const modal = new bootstrap.Modal(deleteModalEl);
                        const confirmInput = document.getElementById('delete-confirm-input');
                        const confirmBtn = document.getElementById('confirm-delete-btn');
                        
                        confirmInput.value = '';
                        confirmBtn.disabled = true;
                        
                        // Use named function or clean up listeners if it's called multiple times, but this is simple enough
                        confirmInput.oninput = (e) => {
                            if (e.target.value === 'DELETE') {
                                confirmBtn.disabled = false;
                            } else {
                                confirmBtn.disabled = true;
                            }
                        };
                        
                        confirmBtn.onclick = async () => {
                            try {
                                confirmBtn.disabled = true;
                                confirmBtn.innerText = 'Deleting...';
                                const response = await fetch(`${API_BASE_URL}/users/${state.user.id}`, {
                                    method: 'DELETE'
                                });
                                if (response.ok) {
                                    alert('Your account has been deleted.');
                                    localStorage.removeItem('treasured_user');
                                    window.location.href = 'index.html';
                                } else {
                                    alert('Failed to delete account. Please try again.');
                                    confirmBtn.disabled = false;
                                    confirmBtn.innerText = 'Permanently Delete';
                                }
                            } catch (error) {
                                console.error('Delete account error:', error);
                                alert('An error occurred. Please try again later.');
                                confirmBtn.disabled = false;
                                confirmBtn.innerText = 'Permanently Delete';
                            }
                        };
                        
                        modal.show();
                    }
                });
            }
        });
    } else if (window.location.pathname.includes('login.html')) {
        handleLogin();
    } else if (window.location.pathname.includes('register.html')) {
        handleRegister();
    } else if (window.location.pathname.includes('list-attire.html')) {
        handleListAttire();
    } else if (window.location.pathname.includes('product-details.html')) {
        loadProductDetails();
        loadRecentlyViewed();
    } else if (window.location.pathname.includes('favorites.html')) {
        loadFavorites();
    } else if (window.location.pathname.includes('register.html') || window.location.pathname.includes('vendor-register.html') || window.location.pathname.includes('list-attire.html') || window.location.pathname.includes('list-service.html')) {
        handleRegister();
        handleVendorRegister();
        handleListAttire();
        handleListService();
    } else if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        loadHomeProducts();
        loadRecentlyViewed();
    }
    
    // Global link updates for favorites
    const favLinks = document.querySelectorAll('.top-bar-item.favorites');
    favLinks.forEach(link => {
        if (!link.querySelector('a')) {
            const wrap = document.createElement('a');
            wrap.href = 'favorites.html';
            wrap.className = 'text-decoration-none text-reset';
            wrap.innerHTML = link.innerHTML;
            link.innerHTML = '';
            link.appendChild(wrap);
        }
    });

    // Update navigation links for categories
    const navLinks = document.querySelectorAll('.nav-menu .nav-link');
    navLinks.forEach(link => {
        if (link.innerText === 'WEDDING DRESSES') link.href = 'category.html?type=wedding';
        if (link.innerText === 'EVENING DRESS') link.href = 'category.html?type=evening';
        if (link.innerText === "MEN'S ATTIRE") link.href = 'category.html?type=men';
        if (link.innerText === 'KIDDOS') link.href = 'category.html?type=kiddos';
    });
});

// Function to meticulously load single product onto product-details.html
async function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        document.getElementById('detail-title').innerText = 'Product Not Found';
        return;
    }
    
    // Fetch product
    const product = await apiFetch(`/products/${productId}`);
    if (!product) {
        document.getElementById('detail-title').innerText = 'Error Loading Product';
        document.getElementById('detail-description').innerText = 'The product could not be loaded. Please check your connection or try again later.';
        return;
    }

    // Log the product view asynchronously
    apiFetch(`/products/${productId}/view`, { method: 'POST' }).catch(() => {});

    // Element bindings
    document.getElementById('detail-title').innerText = product.title || 'Untitled Listing';
    document.getElementById('detail-price').innerText = product.price ? `R${product.price}` : 'R0';
    document.getElementById('detail-original-price').innerText = product.original_price ? `R${product.original_price}` : '';
    document.getElementById('detail-size').innerText = product.size || 'N/A';
    document.getElementById('detail-description').innerText = product.description || '';
    document.getElementById('detail-condition').innerText = product.condition || 'Pre-Loved';
    
    // Attempt fetching seller generic metadata
    if (product.sellerId) {
        const seller = await apiFetch(`/users/${product.sellerId}`);
        if (seller) {
            document.getElementById('detail-seller-name').innerText = `${seller.name || ''} ${seller.surname || ''}`.trim() || seller.username || 'Unknown User';
            // if we captured region at registration or listing it goes here.
            document.getElementById('detail-region').innerText = product.province || product.region || 'South Africa';
        }
    }

    // Process Images
    const mainImgEl = document.getElementById('detail-main-img');
    const thumbnailsContainer = document.getElementById('detail-thumbnails');
    thumbnailsContainer.innerHTML = ''; // clear

    let allImages = [];
    if (product.main_images && Array.isArray(product.main_images)) {
        allImages = allImages.concat(product.main_images);
    } else if (product.imageUrl) {
        allImages.push(product.imageUrl);
    }
    if (product.extra_images && Array.isArray(product.extra_images)) {
        allImages = allImages.concat(product.extra_images);
    }

    if (allImages.length > 0) {
        // Set main image to the very first index
        mainImgEl.src = resolveImageUrl(allImages[0]);
        
        // Render rest as thumbnails
        allImages.forEach((imgBase64, index) => {
            const thumb = document.createElement('img');
            thumb.src = resolveImageUrl(imgBase64);
            thumb.alt = `Thumbnail ${index + 1}`;
            if (index === 0) thumb.classList.add('active'); // highlight the first one
            
            thumb.addEventListener('click', () => {
                mainImgEl.src = resolveImageUrl(imgBase64);
                document.querySelectorAll('#detail-thumbnails img').forEach(i => i.classList.remove('active'));
                thumb.classList.add('active');
            });
            
            thumbnailsContainer.appendChild(thumb);
        });
    } else {
        mainImgEl.src = 'images/intro.png';
    }

    // Add to favorites logic
    const favBtn = document.getElementById('add-to-favorite-btn');
    if (favBtn) {
        let favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
        
        const updateFavBtnState = () => {
            if (favorites.includes(productId)) {
                favBtn.innerHTML = '<i class="fa-solid fa-heart me-2" style="color: var(--gold);"></i> Added to Favorites';
            } else {
                favBtn.innerHTML = '<i class="fa-regular fa-heart me-2"></i> Add to Favorites';
            }
        };
        
        updateFavBtnState();
        
        favBtn.addEventListener('click', (e) => {
            e.preventDefault();
            favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
            if (favorites.includes(productId)) {
                favorites = favorites.filter(id => id !== productId);
            } else {
                favorites.push(productId);
            }
            localStorage.setItem('treasured_favorites', JSON.stringify(favorites));
            updateFavBtnState();
        });
    }

    // Chat logic
    const contactForm = document.getElementById('contact-seller-form');
    const chatInterface = document.getElementById('chat-interface');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input-text');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    function addChatMessage(msg, type) {
        if (!msg.trim()) return;
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '80%';
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.fontSize = '14px';
        
        if (type === 'sent') {
            msgDiv.style.backgroundColor = 'var(--sage-green)';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.borderBottomRightRadius = '4px';
        } else {
            msgDiv.style.backgroundColor = '#f1f1f1';
            msgDiv.style.color = '#333';
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.borderBottomLeftRadius = '4px';
        }
        
        msgDiv.innerText = msg;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    let currentThreadId = null;

    // Handle Contact Seller section based on login status
    const contactSection = document.querySelector('.contact-seller-section');
    if (contactSection) {
        if (!state.user) {
            // Not logged in: Show Login Banner instead of Form
            contactSection.innerHTML = `
                <h2>Contact Seller</h2>
                <div class="p-4 border rounded-4 text-center bg-white shadow-sm mt-3" style="border: 1px solid #e5e5e5 !important;">
                    <i class="fa-solid fa-lock fa-2x mb-3" style="color: var(--gold);"></i>
                    <h5 class="fw-bold mb-2" style="font-family: 'Playfair Display', serif; color: var(--sage-green); font-size: 18px;">Sign In to Inquire</h5>
                    <p class="small text-muted mb-3">You must be logged in to contact the seller and start a chat thread.</p>
                    <a href="login.html" class="btn btn-outline-gold rounded-pill px-4 btn-sm" style="font-size: 13px; font-weight: 500;">Sign In / Register</a>
                </div>
            `;
        } else if (contactForm) {
            // Logged in: Hide name, email, phone input fields because we already have them!
            const inputs = contactForm.querySelectorAll('input');
            inputs.forEach(input => {
                const parent = input.closest('.form-group');
                if (parent) {
                    parent.style.display = 'none';
                    // Remove required attribute so HTML5 form validator doesn't block submit
                    input.removeAttribute('required');
                }
            });
        }
    }

    if (contactForm && chatInterface && state.user) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameVal = state.user.name;
            const emailVal = state.user.email;
            const phoneVal = state.user.phone || '';
            const initialMsgEl = document.getElementById('initial-chat-message');
            const initialMsg = initialMsgEl ? initialMsgEl.value.trim() : '';
            
            if (initialMsg.length < 5) {
                return alert('Message must be at least 5 characters long.');
            }
            
            currentThreadId = `chat_${productId}_${Date.now()}`;
            
            const chatThread = {
                id: currentThreadId,
                productId: productId,
                productTitle: product.title,
                productImage: product.imageUrl || 'images/intro.png',
                buyerName: nameVal,
                buyerEmail: emailVal,
                buyerPhone: phoneVal,
                sellerId: product.sellerId,
                messages: [
                    { sender: 'buyer', text: initialMsg, timestamp: new Date().toISOString() }
                ]
            };
            
            const chats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
            chats.push(chatThread);
            localStorage.setItem('treasured_chats', JSON.stringify(chats));
            
            // Save to server
            fetch(`${API_BASE_URL}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatThread)
            }).catch(e => console.error("Error posting chat thread:", e));

            contactForm.style.display = 'none';
            chatInterface.style.display = 'flex';
            
            if (initialMsg) {
                addChatMessage(initialMsg, 'sent');
                startChatPolling(currentThreadId, 'buyer');
            }
        });
        
        const handleSend = () => {
            const userMsg = chatInput.value.trim();
            if (userMsg) {
                addChatMessage(userMsg, 'sent');
                chatInput.value = '';
                
                // Update thread in localStorage
                const currentChats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
                const t = currentChats.find(x => x.id === currentThreadId);
                if (t) {
                    t.messages.push({ sender: 'buyer', text: userMsg, timestamp: new Date().toISOString() });
                    localStorage.setItem('treasured_chats', JSON.stringify(currentChats));
                    
                    // Save to server
                    fetch(`${API_BASE_URL}/chats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(t)
                    }).catch(e => console.error("Error posting message:", e));
                }
            }
        };
        
        chatSendBtn.addEventListener('click', handleSend);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        });
    }

    // Recently Viewed Logic
    let recentlyViewed = JSON.parse(localStorage.getItem('treasured_recently_viewed') || '[]');
    recentlyViewed = recentlyViewed.filter(id => id !== productId); // Remove if already exists
    recentlyViewed.unshift(productId); // Add to front
    recentlyViewed = recentlyViewed.slice(0, 10); // Keep last 10
    localStorage.setItem('treasured_recently_viewed', JSON.stringify(recentlyViewed));
}

// Function to load recently viewed items
async function loadRecentlyViewed() {
    const grid = document.getElementById('recently-viewed-grid');
    const section = document.getElementById('recently-viewed-section');
    if (!grid || !section) return;

    const viewed = JSON.parse(localStorage.getItem('treasured_recently_viewed') || '[]');
    if (viewed.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    grid.innerHTML = '<p class="text-center w-100">Loading...</p>';
    
    const productPromises = viewed.map(id => apiFetch(`/products/${id}`));
    const products = (await Promise.all(productPromises)).filter(p => p !== null);

    if (products.length === 0) {
        section.style.display = 'none';
        return;
    }

    grid.innerHTML = '';
    products.forEach(product => {
        const productHtml = `
            <div class="outfit-card">
                <div class="outfit-image-container">
                    <img src="${resolveImageUrl(product.imageUrl)}" alt="${product.title}" style="width:120px;height:120px;object-fit:contain;">
                </div>
                <div class="outfit-details">
                    <p class="outfit-desc" style="font-size:13px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${product.description || product.title}">${product.title}</p>
                    <h3 class="outfit-price">R${product.price}</h3>
                    <a href="product-details.html?id=${product.id}" class="btn-outline-gold w-100">View</a>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });
}

// Function to load favorites
async function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;

    const favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
    if (favorites.length === 0) {
        grid.innerHTML = '<p class="text-center w-100 py-5">You haven\'t saved any favorites yet.</p>';
        return;
    }

    grid.innerHTML = '<p class="text-center w-100">Loading your favorites...</p>';
    
    const productPromises = favorites.map(id => apiFetch(`/products/${id}`));
    const products = (await Promise.all(productPromises)).filter(p => p !== null);

    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center w-100 py-5">Your favorite items are no longer available.</p>';
        return;
    }

    grid.innerHTML = '';
    products.forEach(product => {
        const productHtml = `
            <div class="outfit-card category-card">
                <div class="outfit-image-container">
                    <img src="${resolveImageUrl(product.imageUrl)}" alt="${product.title}" style="width:120px;height:120px;object-fit:contain;">
                </div>
                <div class="outfit-details">
                    <p class="outfit-desc" style="font-size:13px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${product.description || product.title}">${product.title}</p>
                    <h3 class="outfit-price">R${product.price}</h3>
                    <a href="product-details.html?id=${product.id}" class="btn-outline-gold w-100 mt-2 mb-2 p-2" style="border-radius:30px;">View</a>
                    <button class="btn btn-sm btn-link text-danger w-100" onclick="removeFromFavorites('${product.id}')">Remove</button>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });
}

// Global helper to remove from favorites
window.removeFromFavorites = function(productId) {
    let favorites = JSON.parse(localStorage.getItem('treasured_favorites') || '[]');
    favorites = favorites.filter(id => id !== productId);
    localStorage.setItem('treasured_favorites', JSON.stringify(favorites));
    loadFavorites();
};

// Function to load products for home page
async function loadHomeProducts() {
    const grid = document.getElementById('recent-outfits-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="text-center w-100">Loading latest outfits...</p>';
    const products = await apiFetch('/products');
    
    if (!products || products.length === 0) {
        // Keep static if API fails or is empty for now, or show message
        return;
    }

    grid.innerHTML = '';
    // Show last 5 products
    const recent = products.slice(-5).reverse();
    recent.forEach(product => {
        const productHtml = `
            <div class="outfit-card">
                <div class="outfit-image-container">
                    <img src="${resolveImageUrl(product.imageUrl)}" alt="${product.title}" width="400" height="400" style="object-fit:cover;">
                </div>
                <div class="outfit-details">
                    <p class="outfit-desc" style="font-size:13px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${product.description || product.title}">${product.title}</p>
                    <h3 class="outfit-price">R${product.price}</h3>
                    <a href="product-details.html?id=${product.id}" class="btn-outline-gold w-100">View</a>
                </div>
            </div>
        `;
        grid.innerHTML += productHtml;
    });
}

// Function to load and manage seller chats in the Dashboard
async function loadDashboardChats() {
    const chatList = document.getElementById('dashboard-chats-list');
    if (!chatList) return;

    chatList.innerHTML = '<p class="text-center w-100">Loading chats...</p>';

    let chats = [];
    try {
        chats = await apiFetch('/chats');
    } catch(err) {
        console.error("Failed to load chats from server", err);
    }
    
    // Filter for chats where the current user is the seller
    const sellerChats = chats.filter(c => c.sellerId === state.user.id);
    
    // Cache locally for fast UI updates
    localStorage.setItem('treasured_chats', JSON.stringify(chats));

    if (sellerChats.length === 0) {
        chatList.innerHTML = '<p class="text-center text-muted p-4 small">No active conversations yet.</p>';
        return;
    }

    chatList.innerHTML = '';
    sellerChats.forEach(chat => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        const lastMsgText = lastMsg ? lastMsg.text : 'No messages yet';
        
        const chatItem = document.createElement('div');
        chatItem.className = 'p-3 border-bottom chat-inbox-item';
        chatItem.style.cursor = 'pointer';
        chatItem.style.transition = 'background-color 0.2s';
        chatItem.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <img src="${chat.productImage || 'images/intro.png'}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 8px;">
                <div class="flex-grow-1 min-w-0">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="mb-0 fw-bold text-truncate" style="font-size: 14px; max-width: 120px;">${chat.buyerName}</h6>
                        <span class="text-muted" style="font-size: 10px;">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <p class="text-muted text-truncate mb-0" style="font-size: 12px; font-weight: 500; color: var(--sage-green) !important;">${chat.productTitle}</p>
                    <p class="text-muted text-truncate mb-0" style="font-size: 11px;">${lastMsgText}</p>
                </div>
            </div>
        `;
        
        chatItem.addEventListener('mouseenter', () => chatItem.style.backgroundColor = '#f1f5f0');
        chatItem.addEventListener('mouseleave', () => {
            if (!chatItem.classList.contains('active-chat-item')) {
                chatItem.style.backgroundColor = 'transparent';
            }
        });
        
        chatItem.addEventListener('click', () => {
            document.querySelectorAll('.chat-inbox-item').forEach(el => {
                el.classList.remove('active-chat-item');
                el.style.backgroundColor = 'transparent';
            });
            chatItem.classList.add('active-chat-item');
            chatItem.style.backgroundColor = '#e8efe7';
            
            openSellerChat(chat.id);
        });
        
        chatList.appendChild(chatItem);
    });
}

async function openSellerChat(threadId) {
    const container = document.getElementById('active-chat-container');
    const noChat = document.getElementById('no-chat-selected');
    if (!container || !noChat) return;
    
    container.classList.remove('d-none');
    container.style.display = 'flex';
    noChat.classList.add('d-none');
    noChat.style.display = 'none';
    
    const chats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
    const chat = chats.find(c => c.id === threadId);
    if (!chat) return;
    
    document.getElementById('chat-buyer-name').innerText = chat.buyerName;
    document.getElementById('chat-product-title').innerText = `Regarding: ${chat.productTitle}`;
    
    // Fetch product details to check sold status
    let product = null;
    try {
        product = await apiFetch(`/products/${chat.productId}`);
    } catch(err) {
        console.error("Error fetching product details", err);
    }
    
    const isSold = product && (product.sold === true || product.status === 'sold');
    const statusBtn = document.getElementById('seller-deal-status-btn');
    const sendBtn = document.getElementById('dash-chat-send-btn');
    const chatInput = document.getElementById('dash-chat-input');
    
    if (isSold) {
        if (statusBtn) {
            statusBtn.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i> Deal Finalized`;
            statusBtn.className = "btn btn-sm btn-success rounded-pill px-3 py-1 fw-500";
        }
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "This listing is closed.";
        }
        if (sendBtn) {
            sendBtn.disabled = true;
        }
    } else {
        if (statusBtn) {
            statusBtn.innerHTML = `<i class="fa-solid fa-clock me-1"></i> Awaiting Buyer Checkout`;
            statusBtn.className = "btn btn-sm btn-outline-gold rounded-pill px-3 py-1 fw-500";
        }
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "Type a message...";
        }
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    const msgGrid = document.getElementById('dashboard-chat-messages');
    msgGrid.innerHTML = '';
    
    chat.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '75%';
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.fontSize = '13px';
        
        // Handle message rendering based on sender
        if (msg.sender === 'system') {
            msgDiv.style.backgroundColor = '#fff3cd';
            msgDiv.style.color = '#856404';
            msgDiv.style.border = '1px solid #ffeeba';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.textAlign = 'center';
            msgDiv.style.fontWeight = '500';
        } else if (msg.sender === 'seller') {
            msgDiv.style.backgroundColor = 'var(--sage-green)';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.borderBottomRightRadius = '4px';
        } else {
            msgDiv.style.backgroundColor = '#f1f1f1';
            msgDiv.style.color = '#333';
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.borderBottomLeftRadius = '4px';
        }
        msgDiv.innerText = msg.text;
        msgGrid.appendChild(msgDiv);
    });
    
    msgGrid.scrollTop = msgGrid.scrollHeight;
    
    if (isSold) return; // Stop binding input events if deal is closed
    
    // Start live polling for new incoming messages!
    startChatPolling(threadId, 'seller');
    
    const handleSellerSend = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = '';
        
        // Append sent message to local thread list
        const updatedChats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
        const targetChat = updatedChats.find(c => c.id === threadId);
        if (targetChat) {
            targetChat.messages.push({
                sender: 'seller',
                text: text,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('treasured_chats', JSON.stringify(updatedChats));
            
            // Save to server
            fetch(`${API_BASE_URL}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(targetChat)
            }).catch(e => console.error("Error posting seller message:", e));
        }
        
        // Re-render chat and inbox lists
        openSellerChat(threadId);
        loadDashboardChats();
    };
    
    // Replace listener with clean node clone to prevent multiple registrations
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', handleSellerSend);
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSellerSend();
        }
    };
    chatInput.removeEventListener('keypress', handleKeyPress);
    chatInput.addEventListener('keypress', handleKeyPress);
}

// Function to load and manage buyer chats in the Favorites page
async function loadBuyerChats() {
    const chatList = document.getElementById('buyer-chats-list');
    if (!chatList) return;

    chatList.innerHTML = '<p class="text-center w-100">Loading chats...</p>';

    let chats = [];
    try {
        chats = await apiFetch('/chats');
    } catch(err) {
        console.error("Failed to load chats from server", err);
    }

    // Filter for chats belonging to this buyer (via email)
    const buyerChats = chats.filter(c => c.buyerEmail === (state.user ? state.user.email : ''));
    
    // Cache locally for UI rendering/syncing
    localStorage.setItem('treasured_chats', JSON.stringify(chats));

    if (buyerChats.length === 0) {
        chatList.innerHTML = '<p class="text-center text-muted p-4 small">No active inquiries yet.</p>';
        return;
    }

    chatList.innerHTML = '';
    buyerChats.forEach(chat => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        const lastMsgText = lastMsg ? lastMsg.text : 'No messages yet';
        
        const chatItem = document.createElement('div');
        chatItem.className = 'p-3 border-bottom chat-inbox-item';
        chatItem.style.cursor = 'pointer';
        chatItem.style.transition = 'background-color 0.2s';
        chatItem.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <img src="${chat.productImage || 'images/intro.png'}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 8px;">
                <div class="flex-grow-1 min-w-0">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="mb-0 fw-bold text-truncate" style="font-size: 14px; max-width: 120px;">Seller of Dress</h6>
                        <span class="text-muted" style="font-size: 10px;">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <p class="text-muted text-truncate mb-0" style="font-size: 12px; font-weight: 500; color: var(--sage-green) !important;">${chat.productTitle}</p>
                    <p class="text-muted text-truncate mb-0" style="font-size: 11px;">${lastMsgText}</p>
                </div>
            </div>
        `;
        
        chatItem.addEventListener('mouseenter', () => chatItem.style.backgroundColor = '#f1f5f0');
        chatItem.addEventListener('mouseleave', () => {
            if (!chatItem.classList.contains('active-chat-item')) {
                chatItem.style.backgroundColor = 'transparent';
            }
        });
        
        chatItem.addEventListener('click', () => {
            document.querySelectorAll('.chat-inbox-item').forEach(el => {
                el.classList.remove('active-chat-item');
                el.style.backgroundColor = 'transparent';
            });
            chatItem.classList.add('active-chat-item');
            chatItem.style.backgroundColor = '#e8efe7';
            
            openBuyerChat(chat.id);
        });
        
        chatList.appendChild(chatItem);
    });
}

async function openBuyerChat(threadId) {
    const container = document.getElementById('buyer-active-chat-container');
    const noChat = document.getElementById('buyer-no-chat-selected');
    if (!container || !noChat) return;
    
    container.classList.remove('d-none');
    container.style.display = 'flex';
    noChat.classList.add('d-none');
    noChat.style.display = 'none';
    
    const chats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
    const chat = chats.find(c => c.id === threadId);
    if (!chat) return;
    
    document.getElementById('buyer-chat-title').innerText = `Seller of the Dress`;
    document.getElementById('buyer-chat-product').innerText = `Regarding: ${chat.productTitle}`;
    
    const proceedBtn = document.getElementById('buyer-proceed-deal-btn');
    const sendBtn = document.getElementById('buyer-chat-send-btn');
    const chatInput = document.getElementById('buyer-chat-input');
    
    // Fetch product details to check sold status
    let product = null;
    try {
        product = await apiFetch(`/products/${chat.productId}`);
    } catch(err) {
        console.error("Error fetching product details", err);
    }
    
    const isSold = product && (product.sold === true || product.status === 'sold');
    
    if (isSold) {
        if (proceedBtn) {
            proceedBtn.disabled = true;
            proceedBtn.innerHTML = `<i class="fa-solid fa-check-double me-1"></i> SOLD`;
            proceedBtn.className = "btn btn-sm btn-success rounded-pill px-3 py-1 fw-500";
        }
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "This listing is now closed.";
        }
        if (sendBtn) {
            sendBtn.disabled = true;
        }
    } else {
        if (proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.innerHTML = `<i class="fa-solid fa-lock me-1"></i> Proceed to Checkout`;
            proceedBtn.className = "btn btn-sm btn-gold rounded-pill px-3 py-1 fw-500";
            proceedBtn.style.backgroundColor = "var(--gold)";
            proceedBtn.style.border = "none";
            proceedBtn.style.color = "white";
        }
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "Type a message...";
        }
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    const msgGrid = document.getElementById('buyer-chat-messages');
    msgGrid.innerHTML = '';
    
    chat.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '75%';
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.fontSize = '13px';
        
        // Handle message rendering based on sender
        if (msg.sender === 'system') {
            msgDiv.style.backgroundColor = '#fff3cd';
            msgDiv.style.color = '#856404';
            msgDiv.style.border = '1px solid #ffeeba';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.textAlign = 'center';
            msgDiv.style.fontWeight = '500';
        } else if (msg.sender === 'buyer') {
            msgDiv.style.backgroundColor = 'var(--sage-green)';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.borderBottomRightRadius = '4px';
        } else {
            msgDiv.style.backgroundColor = '#f1f1f1';
            msgDiv.style.color = '#333';
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.borderBottomLeftRadius = '4px';
        }
        msgDiv.innerText = msg.text;
        msgGrid.appendChild(msgDiv);
    });
    
    msgGrid.scrollTop = msgGrid.scrollHeight;
    
    // Bind Proceed to Checkout action
    if (proceedBtn && !isSold && product) {
        const newProceedBtn = proceedBtn.cloneNode(true);
        proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);
        
        newProceedBtn.addEventListener('click', () => {
            const checkoutModalEl = document.getElementById('checkoutModal');
            if (!checkoutModalEl) return;
            
            const chkImg = document.getElementById('chk-product-img');
            const chkTitle = document.getElementById('chk-product-title');
            const chkPrice = document.getElementById('chk-product-price');
            const chkSubtotal = document.getElementById('chk-subtotal');
            const chkTotal = document.getElementById('chk-total');
            
            chkImg.src = resolveImageUrl(product.imageUrl);
            chkTitle.innerText = product.title;
            chkPrice.innerText = `R${product.price}`;
            chkSubtotal.innerText = `R${product.price}`;
            
            const itemPrice = parseFloat(product.price) || 0;
            const courierFee = 99;
            chkTotal.innerText = `R${(itemPrice + courierFee).toFixed(2)}`;
            
            const courierRadio = document.getElementById('del-courier');
            const meetupRadio = document.getElementById('del-meetup');
            const addressBlock = document.getElementById('checkout-address-block');
            const deliveryRow = document.getElementById('chk-delivery-row');
            
            const updateCheckoutPricing = () => {
                if (courierRadio.checked) {
                    addressBlock.classList.remove('d-none');
                    deliveryRow.style.display = 'flex';
                    chkTotal.innerText = `R${(itemPrice + 99).toFixed(2)}`;
                    document.getElementById('chk-address').required = true;
                } else {
                    addressBlock.classList.add('d-none');
                    deliveryRow.style.display = 'none';
                    chkTotal.innerText = `R${itemPrice.toFixed(2)}`;
                    document.getElementById('chk-address').required = false;
                }
            };
            
            courierRadio.removeEventListener('change', updateCheckoutPricing);
            courierRadio.addEventListener('change', updateCheckoutPricing);
            
            meetupRadio.removeEventListener('change', updateCheckoutPricing);
            meetupRadio.addEventListener('change', updateCheckoutPricing);
            
            // Show modal
            const modal = new bootstrap.Modal(checkoutModalEl);
            modal.show();
            
            // Confirm Checkout Button
            const confirmBtn = document.getElementById('confirm-checkout-btn');
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Pay & Confirm Order';
            
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const form = document.getElementById('checkout-form');
                if (form && !form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                
                newConfirmBtn.disabled = true;
                newConfirmBtn.innerText = 'Processing Order...';
                
                setTimeout(async () => {
                    const finalPrice = courierRadio.checked ? (itemPrice + 99) : itemPrice;
                    const deliveryMethod = courierRadio.checked ? 'Courier Delivery' : 'Local Meetup/Fitting';
                    
                    try {
                        // Create Order Record in Firebase Firestore via Express API
                        await fetch(`${API_BASE_URL}/orders`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                buyerId: state.user ? state.user.id : 'anonymous_buyer',
                                productId: chat.productId,
                                totalAmount: finalPrice,
                                status: 'paid'
                            })
                        });
                        
                        // Mark Product status as Sold in Firestore
                        await fetch(`${API_BASE_URL}/products/${chat.productId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sold: true,
                                status: 'sold'
                            })
                        });
                        
                        // Append system notification to chat messages history
                        const finalChats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
                        const finalChat = finalChats.find(c => c.id === threadId);
                        if (finalChat) {
                            finalChat.messages.push({
                                sender: 'system',
                                text: `📢 System: Deal finalized! This dress has been purchased by ${chat.buyerName} via ${deliveryMethod}. The listing is now closed.`,
                                timestamp: new Date().toISOString()
                            });
                            localStorage.setItem('treasured_chats', JSON.stringify(finalChats));
                        }
                        
                        modal.hide();
                        alert(`Congratulations! Secure purchase completed successfully for ${chat.productTitle}. The listing is now closed.`);
                        openBuyerChat(threadId);
                        loadBuyerChats();
                    } catch(err) {
                        console.error("Error completing purchase transaction", err);
                        alert("Something went wrong during checkout. Please try again.");
                        newConfirmBtn.disabled = false;
                        newConfirmBtn.innerText = 'Pay & Confirm Order';
                    }
                }, 2000);
            });
        });
    }
    
    if (isSold) return; // Stop binding chat events if deal is closed
    
    // Start live polling for new incoming messages!
    startChatPolling(threadId, 'buyer');
    
    // Bind Send actions
    const handleBuyerSend = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = '';
        
        // Append sent message to local thread list
        const updatedChats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
        const targetChat = updatedChats.find(c => c.id === threadId);
        if (targetChat) {
            targetChat.messages.push({
                sender: 'buyer',
                text: text,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('treasured_chats', JSON.stringify(updatedChats));
            
            // Save to server
            fetch(`${API_BASE_URL}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(targetChat)
            }).catch(e => console.error("Error posting buyer message:", e));
        }
        
        // Re-render chat and inbox lists
        openBuyerChat(threadId);
        loadBuyerChats();
    };
    
    // Replace listener with clean node clone to prevent multiple registrations
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', handleBuyerSend);
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBuyerSend();
        }
    };
    chatInput.removeEventListener('keypress', handleKeyPress);
    chatInput.addEventListener('keypress', handleKeyPress);
}

// Expose globally
window.loadBuyerChats = loadBuyerChats;
window.openBuyerChat = openBuyerChat;

// Real-time chat polling state
let chatPollingInterval = null;

// Function to start real-time polling for an active chat
function startChatPolling(threadId, role) {
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
    }
    
    chatPollingInterval = setInterval(async () => {
        try {
            const chat = await apiFetch(`/chats/${threadId}`);
            if (chat && chat.messages) {
                // Read local thread state to see if messages count changed
                const localChats = JSON.parse(localStorage.getItem('treasured_chats') || '[]');
                const idx = localChats.findIndex(c => c.id === threadId);
                
                // If there are new messages, sync local and re-render messages grid
                if (idx === -1 || localChats[idx].messages.length !== chat.messages.length) {
                    if (idx !== -1) {
                        localChats[idx] = chat;
                    } else {
                        localChats.push(chat);
                    }
                    localStorage.setItem('treasured_chats', JSON.stringify(localChats));
                    
                    // Trigger UI re-render based on active role
                    if (role === 'seller') {
                        renderSellerMessagesOnly(chat);
                    } else if (role === 'buyer') {
                        renderBuyerMessagesOnly(chat);
                    }
                }
            }
        } catch(err) {
            // Silently swallow polling errors if server is offline
        }
    }, 3000);
}

function renderSellerMessagesOnly(chat) {
    const msgGrid = document.getElementById('dashboard-chat-messages');
    if (!msgGrid) return;
    
    // Check if the scroll position is currently at the bottom
    const isAtBottom = msgGrid.scrollHeight - msgGrid.scrollTop <= msgGrid.clientHeight + 50;
    
    msgGrid.innerHTML = '';
    chat.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '75%';
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.fontSize = '13px';
        
        if (msg.sender === 'system') {
            msgDiv.style.backgroundColor = '#fff3cd';
            msgDiv.style.color = '#856404';
            msgDiv.style.border = '1px solid #ffeeba';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.textAlign = 'center';
            msgDiv.style.fontWeight = '500';
        } else if (msg.sender === 'seller') {
            msgDiv.style.backgroundColor = 'var(--sage-green)';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.borderBottomRightRadius = '4px';
        } else {
            msgDiv.style.backgroundColor = '#f1f1f1';
            msgDiv.style.color = '#333';
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.borderBottomLeftRadius = '4px';
        }
        msgDiv.innerText = msg.text;
        msgGrid.appendChild(msgDiv);
    });
    
    if (isAtBottom) {
        msgGrid.scrollTop = msgGrid.scrollHeight;
    }
}

function renderBuyerMessagesOnly(chat) {
    const msgGrid = document.getElementById('buyer-chat-messages');
    if (!msgGrid) return;
    
    const isAtBottom = msgGrid.scrollHeight - msgGrid.scrollTop <= msgGrid.clientHeight + 50;
    
    msgGrid.innerHTML = '';
    chat.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.style.maxWidth = '75%';
        msgDiv.style.padding = '8px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.fontSize = '13px';
        
        if (msg.sender === 'system') {
            msgDiv.style.backgroundColor = '#fff3cd';
            msgDiv.style.color = '#856404';
            msgDiv.style.border = '1px solid #ffeeba';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.textAlign = 'center';
            msgDiv.style.fontWeight = '500';
        } else if (msg.sender === 'buyer') {
            msgDiv.style.backgroundColor = 'var(--sage-green)';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.borderBottomRightRadius = '4px';
        } else {
            msgDiv.style.backgroundColor = '#f1f1f1';
            msgDiv.style.color = '#333';
            msgDiv.style.alignSelf = 'flex-start';
            msgDiv.style.borderBottomLeftRadius = '4px';
        }
        msgDiv.innerText = msg.text;
        msgGrid.appendChild(msgDiv);
    });
    
    if (isAtBottom) {
        msgGrid.scrollTop = msgGrid.scrollHeight;
    }
}

// --- Notifications System ---
async function loadNotifications() {
    if (!state.user) return;
    
    try {
        const notifications = await apiFetch('/notifications');
        const badge = document.getElementById('nav-notifications-badge');
        const dropdown = document.getElementById('nav-notifications-dropdown');
        
        if (!badge || !dropdown) return;
        
        if (!notifications || notifications.length === 0) {
            badge.style.display = 'none';
            dropdown.innerHTML = '<div class="notification-empty">No new notifications</div>';
            return;
        }
        
        const unreadCount = notifications.filter(n => !n.read).length;
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
        
        let html = '';
        notifications.forEach(n => {
            const dateStr = new Date(n.createdAt).toLocaleDateString();
            const unreadClass = n.read ? '' : 'unread';
            html += `
                <div class="notification-item ${unreadClass}">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-body">${n.message}</div>
                    <div class="notification-time">${dateStr}</div>
                </div>
            `;
        });
        
        dropdown.innerHTML = html;
        
    } catch (e) {
        console.error('Error loading notifications:', e);
    }
}

async function markNotificationsAsRead() {
    if (!state.user) return;
    try {
        const badge = document.getElementById('nav-notifications-badge');
        if (badge && badge.style.display !== 'none') {
            await apiFetch('/notifications/read-all', { method: 'PUT' });
            badge.style.display = 'none';
            
            // visually update dropdown
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => item.classList.remove('unread'));
        }
    } catch (e) {
        console.error('Error marking notifications read:', e);
    }
}

window.logoutUser = function(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('treasured_user');
    window.location.href = 'index.html';
};
