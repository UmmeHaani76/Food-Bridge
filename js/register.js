document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const submitButton = document.getElementById('submitButton');

    // Show/hide organization name field based on user type
    document.querySelectorAll('input[name="userType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const organizationGroup = document.getElementById('organizationGroup');
            organizationGroup.style.display = this.value === 'ngo' ? 'block' : 'none';
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        submitButton.disabled = true;
        
        try {
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                phone: document.getElementById('phone').value,
                location: document.getElementById('address').value,
                role: document.querySelector('input[name="userType"]:checked').value === 'donor' ? 'Donor' : 'NGO'
            };

            // Add organization name for NGOs
            if (formData.role === 'NGO') {
                formData.organizationName = document.getElementById('organizationName').value;
            }

            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                alert('Registration successful! Please login.');
                window.location.href = 'login.html';
            } else {
                alert(data.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Error during registration:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            submitButton.disabled = false;
        }
    });

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (!value.startsWith('91')) {
            value = '91' + value;
        }
        if (value.length > 12) {
            value = value.slice(0, 12);
        }
        e.target.value = '+' + value.replace(/(\d{2})(\d{10})/, '$1$2');
    });

    // Password confirmation validation
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    function validatePasswords() {
        if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
            confirmPasswordInput.setCustomValidity('Passwords do not match');
        } else {
            confirmPasswordInput.setCustomValidity('');
        }
    }

    passwordInput.addEventListener('change', validatePasswords);
    confirmPasswordInput.addEventListener('keyup', validatePasswords);
});
