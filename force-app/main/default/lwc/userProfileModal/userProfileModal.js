import { LightningElement, api, track, wire } from 'lwc';
import getContactDetails from '@salesforce/apex/PaybookLoginController.getContactDetails';
import updateEmployeeProfile from '@salesforce/apex/PaybookLoginController.updateEmployeeProfile';
import uploadProfilePicture from '@salesforce/apex/PaybookLoginController.uploadProfilePicture';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class UserProfileModal extends LightningElement {
    @api userId; // Can be Contact ID or User ID depending on backend expectation (here Contact ID based on existing code)
    @api isOpen = false;

    @track profileData = {};
    @track isLoading = false;
    
    @track isCropping = false;
    @track zoomScale = 1;
    
    get bloodGroupOptions() {
        return [
            { label: 'A+', value: 'A+' },
            { label: 'A-', value: 'A-' },
            { label: 'B+', value: 'B+' },
            { label: 'B-', value: 'B-' },
            { label: 'AB+', value: 'AB+' },
            { label: 'AB-', value: 'AB-' },
            { label: 'O+', value: 'O+' },
            { label: 'O-', value: 'O-' }
        ];
    }

    get guardianRelationOptions() {
        return [
            { label: 'Father', value: 'Father' },
            { label: 'Mother', value: 'Mother' },
            { label: 'Spouse', value: 'Spouse' },
            { label: 'Sibling', value: 'Sibling' },
            { label: 'Other', value: 'Other' }
        ];
    }
    
    updates = {};

    imgObj;
    panX = 0;
    panY = 0;
    isDragging = false;
    startX = 0;
    startY = 0;
    baseScale = 1;
    cropFileName = 'profile.jpg';
    cropFileType = 'image/jpeg';

    connectedCallback() {
        if (this.userId && this.isOpen) {
            this.fetchData();
        }
    }

    // Watch for open status to fetch data fresh
    @api
    open() {
        this.isOpen = true;
        this.isLoading = true;
        this.updates = {}; // Reset updates
        if (this.userId) {
            this.fetchData();
        }
    }

    @api
    close() {
        this.closeModal();
    }

    fetchData() {
        this.isLoading = true;
        getContactDetails({ contactId: this.userId })
            .then(result => {
                if (result.success) {
                    this.profileData = { ...result };
                } else {
                    this.showToast('Error', 'Could not load profile data.', 'error');
                }
            })
            .catch(error => {
                console.error('Profile fetch error', error);
                this.showToast('Error', 'Error loading profile.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        this.profileData = { ...this.profileData, [field]: value };
        this.updates[field] = value;
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Ensure it's an image
        if (!file.type.startsWith('image/')) {
            this.showToast('Error', 'Please upload a valid image file.', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
             this.showToast('Error', 'Image size must be less than 5MB.', 'error');
             return;
        }
        
        this.cropFileName = file.name;
        this.cropFileType = file.type;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.imgObj = new Image();
            this.imgObj.onload = () => {
                this.isCropping = true;
                this.zoomScale = 1;
                this.panX = 0;
                this.panY = 0;
                
                const minDimension = Math.min(this.imgObj.width, this.imgObj.height);
                this.baseScale = 300 / minDimension;

                setTimeout(() => this.drawCanvas(), 50);
            };
            this.imgObj.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    drawCanvas() {
        const canvas = this.template.querySelector('[data-id="cropCanvas"]');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const scale = this.baseScale * this.zoomScale;
        const scaledWidth = this.imgObj.width * scale;
        const scaledHeight = this.imgObj.height * scale;
        
        const x = (canvas.width - scaledWidth) / 2 + this.panX;
        const y = (canvas.height - scaledHeight) / 2 + this.panY;
        
        ctx.drawImage(this.imgObj, x, y, scaledWidth, scaledHeight);
    }

    handleZoomChange(event) {
        this.zoomScale = parseFloat(event.target.value);
        this.drawCanvas();
    }

    handleMouseDown(event) {
        this.isDragging = true;
        this.startX = event.clientX - this.panX;
        this.startY = event.clientY - this.panY;
    }

    handleMouseMove(event) {
        if (!this.isDragging) return;
        this.panX = event.clientX - this.startX;
        this.panY = event.clientY - this.startY;
        this.drawCanvas();
    }

    handleMouseUp() { this.isDragging = false; }
    
    handleTouchStart(event) {
        if(event.touches && event.touches.length > 0) {
            this.isDragging = true;
            this.startX = event.touches[0].clientX - this.panX;
            this.startY = event.touches[0].clientY - this.panY;
        }
    }
    handleTouchMove(event) {
        if (!this.isDragging) return;
        if(event.touches && event.touches.length > 0) {
            this.panX = event.touches[0].clientX - this.startX;
            this.panY = event.touches[0].clientY - this.startY;
            this.drawCanvas();
        }
    }
    handleTouchEnd() { this.isDragging = false; }

    cancelCrop() {
        this.isCropping = false;
        this.imgObj = null;
    }
    
    handleCropAndUpload() {
        this.isLoading = true;
        const canvas = this.template.querySelector('[data-id="cropCanvas"]');
        const dataUrl = canvas.toDataURL(this.cropFileType, 0.9);
        const base64Data = dataUrl.split(',')[1];
        
        uploadProfilePicture({ 
            contactId: this.userId, 
            base64Data: base64Data, 
            fileName: this.cropFileName, 
            contentType: this.cropFileType 
        })
        .then((url) => {
            this.profileData = { ...this.profileData, profilePictureUrl: url };
            this.showToast('Success', 'Profile picture updated successfully!', 'success');
            this.dispatchEvent(new CustomEvent('profileupdate', { 
                detail: { ...this.profileData } 
            }));
            this.isCropping = false;
            this.imgObj = null;
        })
        .catch(error => {
            console.error('File upload error', error);
            this.showToast('Error', error.body ? error.body.message : 'Error uploading picture.', 'error');
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    handleSave() {
        if (Object.keys(this.updates).length === 0) {
            this.closeModal();
            return;
        }

        this.isLoading = true;
        updateEmployeeProfile({ contactId: this.userId, updates: this.updates })
            .then(() => {
                this.showToast('Success', 'Profile updated successfully!', 'success');
                // Notify parent
                this.dispatchEvent(new CustomEvent('profileupdate', { 
                    detail: { ...this.profileData } 
                }));
                this.closeModal();
            })
            .catch(error => {
                console.error('Profile update error', error);
                this.showToast('Error', error.body ? error.body.message : error.message, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    closeModal() {
        this.isOpen = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}