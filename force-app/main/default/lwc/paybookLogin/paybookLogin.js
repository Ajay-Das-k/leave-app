import { LightningElement, track } from 'lwc';
import authenticateEmployee from '@salesforce/apex/PaybookLoginController.authenticateEmployee';
import resetPassword from '@salesforce/apex/PaybookLoginController.resetPassword';
import generateResetOTP from '@salesforce/apex/PaybookLoginController.generateResetOTP';
import registerEmployee from '@salesforce/apex/PaybookSignupController.registerEmployee';
import changeDefaultPassword from '@salesforce/apex/PaybookLoginController.changeDefaultPassword';
export default class PaybookLogin extends LightningElement {
    // ... existing props ...

    // ========== FORGOT PASSWORD HANDLERS ==========

    // ... existing handlers ...


    // Login fields
    @track employeeId = '';
    @track password = '';
    @track isLoading = false;

    connectedCallback() {
        console.log('PaybookLogin Component Loaded - Version 2.0 (Signup Handlers Added)');
        console.log('isSignupMode:', this.isSignupMode);
    }
    @track showError = false;
    @track errorMessage = '';
    
    // Signup fields
    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track employeeType = '';  // Fixed: matches Employee_Type__c
    @track joiningDate = '';   // Fixed: matches Joining_Date__c
    @track department = '';
    @track signupPassword = '';
    @track confirmPassword = '';
    @track signupError = false;
    @track signupErrorMessage = '';
    @track signupSuccess = false;
    @track signupSuccessMessage = '';
    
    // New Fields
    @track gender = '';
    @track mobile = '';
    @track birthdate = '';
    @track workLocation = '';
    
    // Cropper State
    @track showCropper = false;
    @track croppedImageBase64 = '';
    @track cropScale = 1;
    imgObj = null;
    isDragging = false;
    startX = 0;
    startY = 0;
    offsetX = 0;
    offsetY = 0;
    
    // State Management
    @track isLoginMode = true;
    @track isSignupMode = false;
    @track isForgotPasswordMode = false;
    @track isForcePasswordChange = false;

    pendingLoginResult = null;
    @track forceNewPassword = '';
    @track forceConfirmPassword = '';
    @track forceError = false;
    @track forceErrorMessage = '';
    @track forceSuccess = false;
    @track forceSuccessMessage = '';

    // Reset Password Fields
    @track resetEmployeeId = '';
    @track resetEmail = '';
    @track resetOTP = '';
    @track resetNewPassword = '';
    @track resetConfirmPassword = '';
    @track resetError = false;
    @track resetErrorMessage = '';
    @track resetSuccess = false;
    @track resetSuccessMessage = '';
    
    // OTP State
    @track otpRequested = false;

    // ========== LOGIN HANDLERS ==========
    
    handleEmployeeIdChange(event) {
        this.employeeId = event.target.value.toUpperCase();
    }

    handlePasswordChange(event) {
        this.password = event.target.value;
    }

    async handleLogin(event) {
        event.preventDefault();
        this.showError = false;
        this.isLoading = true;

        try {
            const result = await authenticateEmployee({
                employeeId: this.employeeId,
                password: this.password
            });

            if (result.success) {
                if (this.password === 'WELCOME@CRMantra12') {
                    this.isLoginMode = false;
                    this.isForcePasswordChange = true;
                    this.pendingLoginResult = result;
                    return;
                }
                
                // Dispatch event to parent component
                this.dispatchEvent(new CustomEvent('login', {
                        detail: result,
                    bubbles: true,
                    composed: true
                }));

                this.employeeId = '';
                this.password = '';
            } else {
                this.showError = true;
                this.errorMessage = result.message;
                this.password = '';
            }
        } catch (error) {
            this.showError = true;
            this.errorMessage = 'Login failed. Please try again.';
            console.error('Login error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // ========== FORCED PASSWORD RESET HANDLERS ==========

    handleForceNewPasswordChange(event) {
        this.forceNewPassword = event.target.value;
    }

    handleForceConfirmPasswordChange(event) {
        this.forceConfirmPassword = event.target.value;
    }

    async handleChangeDefaultPassword(event) {
        event.preventDefault();
        this.forceError = false;
        
        if (this.forceNewPassword !== this.forceConfirmPassword) {
            this.forceError = true;
            this.forceErrorMessage = "Passwords do not match";
            return;
        }
        
        const pwdPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        if (!pwdPattern.test(this.forceNewPassword)) {
             this.forceError = true;
             this.forceErrorMessage = "Password must be at least 8 chars long with at least 1 letter and 1 number.";
             return;
        }

        this.isLoading = true;

        try {
            const result = await changeDefaultPassword({
                 employeeId: this.employeeId,
                 newPassword: this.forceNewPassword
            });
            
            if (result && result.success) {
                this.forceSuccess = true;
                this.forceSuccessMessage = 'Password updated successfully! Logging you in...';
                
                setTimeout(() => {
                    this.dispatchEvent(new CustomEvent('login', {
                            detail: result,
                        bubbles: true,
                        composed: true
                    }));
                    this.employeeId = '';
                    this.password = '';
                }, 2000);
            } else {
                 this.forceError = true;
                 this.forceErrorMessage = result ? result.message : 'Unknown error';
            }

        } catch(error) {
             this.forceError = true;
             this.forceErrorMessage = error.body ? error.body.message : error.message;
             console.error('Password change error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // ========== FORGOT PASSWORD HANDLERS ==========

    handleResetEmployeeIdChange(event) {
        this.resetEmployeeId = event.target.value.toUpperCase();
    }
    
    handleResetEmailChange(event) {
        this.resetEmail = event.target.value;
    }
    
    handleResetOTPChange(event) {
        this.resetOTP = event.target.value;
    }
    
    handleResetNewPasswordChange(event) {
        this.resetNewPassword = event.target.value;
    }
    
    handleResetConfirmPasswordChange(event) {
        this.resetConfirmPassword = event.target.value;
    }

    async handleRequestOTP() {
        this.resetError = false;
        this.resetSuccess = false;
        
        if (!this.resetEmployeeId || !this.resetEmail) {
            this.resetError = true;
            this.resetErrorMessage = 'Please enter both Employee ID and Email to request OTP.';
            return;
        }
        
        this.isLoading = true;
        try {
            const result = await generateResetOTP({
                employeeId: this.resetEmployeeId,
                email: this.resetEmail
            });
            
            if (result) {
                this.otpRequested = true;
                this.resetSuccess = true;
                this.resetSuccessMessage = 'An OTP has been sent to your email.';
                setTimeout(() => { this.resetSuccess = false; }, 3000);
            } else {
                this.resetError = true;
                this.resetErrorMessage = 'Employee ID and Email do not match our records.';
            }
        } catch (error) {
            this.resetError = true;
            this.resetErrorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    // Timer methods removed

    async handleResetPassword(event) {
        event.preventDefault();
        this.resetError = false;
        this.resetSuccess = false;
        
        if (!this.resetOTP || this.resetOTP.length !== 6) {
            this.resetError = true;
            this.resetErrorMessage = "Please enter a valid 6-digit OTP";
            return;
        }
        
        if (this.resetNewPassword !== this.resetConfirmPassword) {
            this.resetError = true;
            this.resetErrorMessage = "Passwords do not match";
            return;
        }
        
        // Client-side regex check (min 8 chars, 1 letter, 1 number)
        const pwdPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        if (!pwdPattern.test(this.resetNewPassword)) {
             this.resetError = true;
             this.resetErrorMessage = "Password must be at least 8 characters long and contain at least one letter and one number.";
             return;
        }

        this.isLoading = true;

        try {
            const result = await resetPassword({
                 employeeId: this.resetEmployeeId,
                 email: this.resetEmail,
                 otp: this.resetOTP,
                 newPassword: this.resetNewPassword
            });
            
            if (result) {
                this.resetSuccess = true;
                this.resetSuccessMessage = 'Password reset successfully! Redirecting to login...';
                setTimeout(() => {
                    this.toggleMode(); // Switch back to login
                }, 2000);
            }

        } catch(error) {
             this.resetError = true;
             this.resetErrorMessage = error.body ? error.body.message : error.message;
             console.error('Reset error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // ========== SIGNUP HANDLERS ==========
    
    handleFirstNameChange(event) {
        this.firstName = event.target.value;
    }

    handleLastNameChange(event) {
        this.lastName = event.target.value;
    }

    handleEmailChange(event) {
        this.email = event.target.value;
    }

    handleSignupEmployeeIdChange(event) {
        this.employeeId = event.target.value.toUpperCase();
    }

    handleDepartmentChange(event) {
        this.department = event.target.value;
    }

    handleEmployeeTypeChange(event) {
        this.employeeType = event.target.value;
    }
    
    handleGenderChange(event) {
        this.gender = event.target.value;
    }
    
    handleMobileChange(event) {
        this.mobile = event.target.value;
    }
    
    handleBirthdateChange(event) {
        this.birthdate = event.target.value;
    }

    handleJoiningDateChange(event) {
        this.joiningDate = event.target.value;
    }

    handleSignupPasswordChange(event) {
        this.signupPassword = event.target.value;
    }

    handleConfirmPasswordChange(event) {
        this.confirmPassword = event.target.value;
    }
    
    handleWorkLocationChange(event) {
        this.workLocation = event.target.value;
    }

    handleProfilePicSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.imgObj = img;
                    this.showCropper = true;
                    this.cropScale = 1;
                    this.offsetX = 0;
                    this.offsetY = 0;
                    setTimeout(() => this.drawCropCanvas(), 50);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    handleCropScale(event) {
        this.cropScale = parseFloat(event.target.value);
        this.drawCropCanvas();
    }

    drawCropCanvas() {
        const canvas = this.template.querySelector('.crop-canvas');
        if (!canvas || !this.imgObj) return;
        const ctx = canvas.getContext('2d');
        const size = 150;
        
        ctx.clearRect(0, 0, size, size);
        
        const scaleX = size / this.imgObj.width;
        const scaleY = size / this.imgObj.height;
        const baseScale = Math.max(scaleX, scaleY);
        const finalScale = baseScale * this.cropScale;
        
        const drawWidth = this.imgObj.width * finalScale;
        const drawHeight = this.imgObj.height * finalScale;
        
        const cx = (size - drawWidth) / 2 + this.offsetX;
        const cy = (size - drawHeight) / 2 + this.offsetY;
        
        ctx.drawImage(this.imgObj, cx, cy, drawWidth, drawHeight);
    }

    handleCropDragStart(event) {
        this.isDragging = true;
        this.startX = event.clientX || (event.touches && event.touches[0].clientX);
        this.startY = event.clientY || (event.touches && event.touches[0].clientY);
    }

    handleCropDragMove(event) {
        if (!this.isDragging) return;
        event.preventDefault();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        
        this.offsetX += (clientX - this.startX);
        this.offsetY += (clientY - this.startY);
        
        this.startX = clientX;
        this.startY = clientY;
        this.drawCropCanvas();
    }

    handleCropDragEnd() {
        this.isDragging = false;
    }

    applyCrop() {
        const canvas = this.template.querySelector('.crop-canvas');
        if (canvas) {
            this.croppedImageBase64 = canvas.toDataURL('image/png');
            this.showCropper = false;
        }
    }

    removeProfilePic() {
        this.croppedImageBase64 = '';
        const fileInput = this.template.querySelector('#profilePic');
        if (fileInput) fileInput.value = '';
    }

    async handleSignup(event) {
        event.preventDefault();
        this.signupError = false;
        this.signupSuccess = false;
        this.isLoading = true;

        try {
            const result = await registerEmployee({
                firstName: this.firstName,
                lastName: this.lastName,
                email: this.email,
                employeeId: this.employeeId,
                password: this.signupPassword,
                confirmPassword: this.confirmPassword,
                department: this.department,
                employeeType: this.employeeType,
                joiningDate: this.joiningDate,
                
                // New Fields
                gender: this.gender,
                mobile: this.mobile,
                birthdate: this.birthdate,
                workLocation: this.workLocation,
                profilePicBase64: this.croppedImageBase64
            });

            if (result.success) {
                this.signupSuccess = true;
                this.signupSuccessMessage = result.message;
                
                // Optional: Auto login or redirect to login
                setTimeout(() => {
                    this.toggleMode(); // Switch to login
                }, 2000);
            } else {
                this.signupError = true;
                this.signupErrorMessage = result.message;
            }
        } catch (error) {
            this.signupError = true;
            this.signupErrorMessage = error.body ? error.body.message : error.message;
            console.error('Signup error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // ========== UTILITY METHODS ==========
    
    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.isSignupMode = !this.isLoginMode; // If not login, then signup
        this.isForgotPasswordMode = false;
        this.isForcePasswordChange = false;
        this.clearForm();
    }

    toggleForgotPassword() {
        this.isForgotPasswordMode = !this.isForgotPasswordMode;
        this.isLoginMode = !this.isForgotPasswordMode;
        this.isSignupMode = false;
        this.isForcePasswordChange = false;
        this.clearResetForm();
    }

    clearForm() {
        this.employeeId = '';
        this.password = '';
        this.showError = false;
        this.errorMessage = '';
        this.clearSignupForm();
    }
    
    clearResetForm() {
        this.resetEmployeeId = '';
        this.resetEmail = '';
        this.resetOTP = '';
        this.resetNewPassword = '';
        this.resetConfirmPassword = '';
        this.resetError = false;
        this.resetErrorMessage = '';
        this.resetSuccess = false;
        this.resetSuccessMessage = '';
        this.otpRequested = false;
    }

    clearSignupForm() {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.employeeId = '';
        this.department = '';
        this.employeeType = '';
        this.joiningDate = '';
        this.signupPassword = '';
        this.confirmPassword = '';
        this.signupError = false;
        this.signupErrorMessage = '';
        this.signupSuccess = false;
        this.signupSuccess = false;
        this.signupSuccessMessage = '';
        this.gender = '';
        this.mobile = '';
        this.birthdate = '';
        this.workLocation = '';
        this.croppedImageBase64 = '';
        this.showCropper = false;
    }
}