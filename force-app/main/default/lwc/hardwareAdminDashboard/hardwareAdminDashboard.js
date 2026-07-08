import { LightningElement, track, wire } from 'lwc';
import getHardwareInventory from '@salesforce/apex/HardwareController.getHardwareInventory';
import addHardware from '@salesforce/apex/HardwareController.addHardware';
import assignHardware from '@salesforce/apex/HardwareController.assignHardware';
import updateHardware from '@salesforce/apex/HardwareController.updateHardware';
import deleteHardware from '@salesforce/apex/HardwareController.deleteHardware';
import getHardwareRequests from '@salesforce/apex/HardwareController.getHardwareRequests';
import updateRequestStatus from '@salesforce/apex/HardwareController.updateRequestStatus';
import getHardwareTickets from '@salesforce/apex/HardwareController.getHardwareTickets';
import updateTicketStatusWithRequest from '@salesforce/apex/HardwareController.updateTicketStatusWithRequest';
import createHardwareTicket from '@salesforce/apex/HardwareController.createHardwareTicket';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningAlert from 'lightning/alert';
import LightningConfirm from 'lightning/confirm';

export default class HardwareAdminDashboard extends LightningElement {
    
    get callerId() {
        const userJson = sessionStorage.getItem('paybookUser');
        if (userJson) {
            try {
                const user = JSON.parse(userJson);
                return user.contactId;
            } catch (e) {
                console.error(e);
            }
        }
        return '';
    }

    @track inventoryList = [];
    @track requestList = [];
    @track ticketList = [];
    @track inventoryLoading = false;
    @track requestsLoading = false;
    @track ticketsLoading = false;
    @track searchKey = '';
    
    // Details Modal
    @track isDetailsModalOpen = false;
    @track selectedHardware = null;

    // Edit Modal
    @track editHardwareId = null;
    @track editName = '';
    @track editType = '';
    @track editStatus = '';
    @track editUsername = '';
    @track editPassword = '';
    @track editNotes = '';
    @track editAssignedToId = null;
    @track editLocation = '';
    @track editYearOfManufacture = null;
    @track editExpectedLifeSpan = null;
    @track editOs = '';
    @track editShowCropper = false;
    @track editCroppedImageBase64 = '';
    @track editExistingImageUrl = '';
    @track editCropScale = 1;
    @track isEditModalOpen = false;
    
    editStatusOptions = [
        { label: 'Under Maintenance', value: 'Under Maintenance' },
        { label: 'Retired', value: 'Retired' }
    ];
    editImgObj = null;
    editOffsetX = 0;
    editOffsetY = 0;
    editStartX = 0;
    editStartY = 0;
    editIsDragging = false;

    typeOptions = [
        { label: 'Laptop', value: 'Laptop' },
        { label: 'Monitor', value: 'Monitor' },
        { label: 'Mobile', value: 'Mobile' },
        { label: 'Keyboard', value: 'Keyboard' },
        { label: 'Mouse', value: 'Mouse' },
        { label: 'Cables', value: 'Cables' },
        { label: 'Headphones', value: 'Headphones' },
        { label: 'Keyboard Mouse Combo', value: 'Keyboard Mouse Combo' },
        { label: 'Hub', value: 'Hub' },
        { label: 'Modem', value: 'Modem' },
        { label: 'Network Hardware', value: 'Network Hardware' },
        { label: 'CPU', value: 'CPU' },
        { label: 'Servers', value: 'Servers' },
        { label: 'Accessory', value: 'Accessory' },
        { label: 'Other', value: 'Other' }
    ];

    statusOptions = [
        { label: 'Available', value: 'Available' },
        { label: 'Assigned', value: 'Assigned' },
        { label: 'Under Maintenance', value: 'Under Maintenance' },
        { label: 'Retired', value: 'Retired' }
    ];

    locationOptions = [
        { label: 'Home', value: 'Home' },
        { label: 'Office', value: 'Office' }
    ];

    osOptions = [
        { label: 'Windows 10', value: 'Windows 10' },
        { label: 'Windows 11', value: 'Windows 11' },
        { label: 'macOS', value: 'macOS' },
        { label: 'Linux', value: 'Linux' },
        { label: 'ChromeOS', value: 'ChromeOS' },
        { label: 'Other', value: 'Other' }
    ];

    get isLaptop() {
        return this.newHardware.type === 'Laptop';
    }

    get isEditLaptop() {
        return this.editType === 'Laptop';
    }

    get isNewNotesRequired() {
        return this.newHardware.status === 'Under Maintenance' || this.newHardware.status === 'Retired';
    }

    get isEditNotesRequired() {
        return this.editStatus === 'Under Maintenance' || this.editStatus === 'Retired';
    }

    @track newHardware = {
        name: '',
        type: '',
        status: 'Available',
        location: '',
        serialNumber: '',
        assignedToId: null,
        yearOfManufacture: null,
        expectedLifeSpan: null,
        os: '',
        username: '',
        password: '',
        notes: ''
    };

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

    connectedCallback() {
        this.loadInventory();
        this.loadRequests();
        this.loadTickets();
    }

    async loadInventory() {
        this.inventoryLoading = true;
        try {
            const data = await getHardwareInventory({ callerId: this.callerId });
            this.inventoryList = data.map(item => ({
                ...item,
                statusClass: item.Status__c === 'Available' ? 'slds-badge slds-theme_success' : 
                             item.Status__c === 'Assigned' ? 'slds-badge slds-theme_info' : 
                             item.Status__c === 'Under Maintenance' ? 'slds-badge slds-theme_warning' : 'slds-badge slds-theme_error',
                showCautionBtn: item.Assigned_To__c && item.Life_Span_Consumed_Percentage__c >= 100
            }));
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        } finally {
            this.inventoryLoading = false;
        }
    }

    async loadRequests() {
        this.requestsLoading = true;
        try {
            const data = await getHardwareRequests({ callerId: this.callerId });
            this.requestList = data.map(req => ({
                ...req,
                formattedDate: new Date(req.CreatedDate).toLocaleDateString(),
                isPending: req.Status__c === 'Pending TSA',
                statusClass: req.Status__c === 'Pending TSA' ? 'slds-badge slds-theme_warning' : 
                             req.Status__c === 'Forwarded to HR/Manager' ? 'slds-badge slds-badge_lightest' : 
                             req.Status__c === 'Fulfilled' || req.Status__c === 'Approved' ? 'slds-badge slds-theme_success' : 'slds-badge slds-theme_error'
            }));
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        } finally {
            this.requestsLoading = false;
        }
    }

    get pendingRequests() {
        return this.requestList ? this.requestList.filter(req => req.Status__c === 'Pending TSA' || req.Status__c === 'Forwarded to HR/Manager') : [];
    }

    get solvedRequests() {
        return this.requestList ? this.requestList.filter(req => req.Status__c === 'Approved' || req.Status__c === 'Rejected' || req.Status__c === 'Fulfilled') : [];
    }

    get pendingTickets() {
        return this.filteredTickets ? this.filteredTickets.filter(t => t.Status__c === 'Created Ticket' || t.Status__c === 'Forwarded to Admin') : [];
    }

    get solvedTickets() {
        return this.filteredTickets ? this.filteredTickets.filter(t => t.Status__c === 'Solved by Admin' || t.Status__c === 'Solved by HR/Manager' || t.Status__c === 'Hardware will be Delivered') : [];
    }

    get hasPendingRequests() {
        return this.pendingRequests.length > 0;
    }

    get hasSolvedRequests() {
        return this.solvedRequests.length > 0;
    }

    get hasPendingTickets() {
        return this.pendingTickets.length > 0;
    }

    get hasSolvedTickets() {
        return this.solvedTickets.length > 0;
    }

    get filteredInventoryList() {
        if (!this.searchKey) {
            return this.inventoryList;
        }
        const lowerKey = this.searchKey.toLowerCase();
        return this.inventoryList.filter(item => {
            const hwName = item.Name ? item.Name.toLowerCase() : '';
            const empName = item.Assigned_To__r ? item.Assigned_To__r.Name.toLowerCase() : '';
            return hwName.includes(lowerKey) || empName.includes(lowerKey);
        });
    }

    handleSearchChange(event) {
        this.searchKey = event.target.value;
    }

    handleHardwareChange(event) {
        const field = event.target.name;
        this.newHardware[field] = event.target.value;
    }

    handleAssignChange(event) {
        this.newHardware.assignedToId = event.detail.recordId;
    }

    handleHardwarePicSelect(event) {
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
        const size = 200;
        
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

    removeHardwarePic() {
        this.croppedImageBase64 = '';
        const fileInputs = this.template.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => input.value = '');
    }

    async submitNewHardware() {
        if (this.showCropper) {
            this.applyCrop();
        }

        if (!this.newHardware.name || !this.newHardware.type || !this.newHardware.status || !this.newHardware.location) {
            this.showToast('Error', 'Please fill all required fields.', 'error');
            return;
        }

        let yom = this.newHardware.yearOfManufacture ? parseInt(this.newHardware.yearOfManufacture, 10) : null;
        let els = this.newHardware.expectedLifeSpan ? parseInt(this.newHardware.expectedLifeSpan, 10) : null;

        try {
            await addHardware({
                name: this.newHardware.name,
                type: this.newHardware.type,
                status: this.newHardware.status,
                serialNumber: this.newHardware.serialNumber,
                assignedToId: this.newHardware.assignedToId || null,
                location: this.newHardware.location,
                imageBase64: this.croppedImageBase64,
                yearOfManufacture: yom,
                expectedLifeSpan: els,
                os: this.newHardware.os,
                username: this.newHardware.username,
                password: this.newHardware.password,
                notes: this.newHardware.notes,
                callerId: this.callerId
            });
            await LightningAlert.open({
                message: 'Hardware added to inventory successfully.',
                theme: 'success',
                label: 'Success!'
            });
            
            // Reset form
            this.newHardware = { name: '', type: '', status: 'Available', location: '', serialNumber: '', assignedToId: null, yearOfManufacture: null, expectedLifeSpan: null, os: '', username: '', password: '', notes: '' };
            this.croppedImageBase64 = '';
            this.showCropper = false;
            
            // Reload list
            this.loadInventory();
        } catch (error) {
            LightningAlert.open({
                message: error.body?.message || error.message,
                theme: 'error',
                label: 'Error'
            });
        }
    }

    async handleUnassignHardware(event) {
        const hardwareId = event.currentTarget.dataset.id;
        try {
            await assignHardware({ hardwareId: hardwareId, contactId: null, location: null, callerId: this.callerId });
            this.showToast('Success', 'Hardware unassigned.', 'success');
            this.loadInventory();
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        }
    }

    openDetailsModal(event) {
        const hardwareId = event.currentTarget.dataset.id;
        this.selectedHardware = this.inventoryList.find(h => h.Id === hardwareId);
        this.isDetailsModalOpen = true;
    }

    closeDetailsModal() {
        this.isDetailsModalOpen = false;
        this.selectedHardware = null;
    }

    openEditModal(event) {
        this.editHardwareId = event.currentTarget.dataset.id;
        const hw = this.inventoryList.find(h => h.Id === this.editHardwareId);
        if (hw) {
            this.editName = hw.Name;
            this.editType = hw.Type__c;
            this.editStatus = hw.Status__c;
            this.editUsername = hw.Username__c || '';
            this.editPassword = hw.Password__c || '';
            this.editNotes = hw.Notes__c || '';
            this.editAssignedToId = hw.Assigned_To__c;
            this.editLocation = hw.Location__c;
            this.editYearOfManufacture = hw.Year_of_Manufacture__c;
            this.editExpectedLifeSpan = hw.Expected_Life_Span_Years__c;
            this.editOs = hw.OS__c;
            this.editExistingImageUrl = hw.Image_URL__c;
        }
        this.editShowCropper = false;
        this.editCroppedImageBase64 = '';
        this.editCropScale = 1;
        this.isEditModalOpen = true;
    }

    closeEditModal() {
        this.isEditModalOpen = false;
        this.editHardwareId = null;
        this.editName = '';
        this.editType = '';
        this.editStatus = '';
        this.editUsername = '';
        this.editPassword = '';
        this.editNotes = '';
        this.editAssignedToId = null;
        this.editLocation = '';
        this.editYearOfManufacture = null;
        this.editExpectedLifeSpan = null;
        this.editOs = '';
        this.editShowCropper = false;
        this.editCroppedImageBase64 = '';
        this.editExistingImageUrl = '';
        this.editCropScale = 1;
        this.editImgObj = null;
        this.editOffsetX = 0;
        this.editOffsetY = 0;
    }

    handleEditNameChange(event) {
        this.editName = event.target.value;
    }

    handleEditTypeChange(event) {
        this.editType = event.detail.value;
    }

    handleEditStatusChange(event) {
        this.editStatus = event.detail.value;
        if (this.editStatus === 'Under Maintenance' || this.editStatus === 'Retired') {
            this.editAssignedToId = null;
        }
    }

    handleEditUsernameChange(event) {
        this.editUsername = event.target.value;
    }

    handleEditPasswordChange(event) {
        this.editPassword = event.target.value;
    }

    handleEditNotesChange(event) {
        this.editNotes = event.target.value;
    }

    handleEditAssignChange(event) {
        this.editAssignedToId = event.detail.recordId;
        if (this.editAssignedToId) {
            this.editStatus = 'Assigned';
        } else if (this.editStatus === 'Assigned') {
            this.editStatus = 'Available';
        }
    }

    handleEditLocationChange(event) {
        this.editLocation = event.target.value;
    }

    handleEditYearChange(event) {
        this.editYearOfManufacture = event.target.value;
    }

    handleEditLifeSpanChange(event) {
        this.editExpectedLifeSpan = event.target.value;
    }

    handleEditOsChange(event) {
        this.editOs = event.target.value;
    }

    async saveEditHardware() {
        if (!this.editName || !this.editType) {
            this.showToast('Error', 'Please fill name and type.', 'error');
            return;
        }
        if (this.editShowCropper) {
            this.applyEditCrop();
        }
        let yom = this.editYearOfManufacture ? parseInt(this.editYearOfManufacture, 10) : null;
        let els = this.editExpectedLifeSpan ? parseInt(this.editExpectedLifeSpan, 10) : null;

        try {
            await updateHardware({ 
                hardwareId: this.editHardwareId,
                name: this.editName,
                type: this.editType,
                status: this.editStatus,
                contactId: this.editAssignedToId || null,
                location: this.editLocation,
                yearOfManufacture: yom,
                expectedLifeSpan: els,
                os: this.editOs,
                username: this.editUsername,
                password: this.editPassword,
                notes: this.editNotes,
                imageBase64: this.editCroppedImageBase64,
                callerId: this.callerId
            });
            this.closeEditModal();
            await LightningAlert.open({
                message: 'Hardware updated successfully.',
                theme: 'success',
                label: 'Success'
            });
            this.loadInventory();
        } catch (error) {
            LightningAlert.open({
                message: error.body?.message || error.message,
                theme: 'error',
                label: 'Error'
            });
        }
    }

    async handleDeleteHardware() {
        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to delete this hardware? This action cannot be undone.',
            variant: 'headerless',
            label: 'Delete Hardware'
        });
        if (!confirmed) return;

        try {
            await deleteHardware({ hardwareId: this.editHardwareId, callerId: this.callerId });
            this.closeEditModal();
            await LightningAlert.open({
                message: 'Hardware deleted successfully.',
                theme: 'success',
                label: 'Success'
            });
            this.loadInventory();
        } catch (error) {
            LightningAlert.open({
                message: error.body?.message || error.message,
                theme: 'error',
                label: 'Error'
            });
        }
    }

    async handleSendCautionTicket(event) {
        const hardwareId = event.currentTarget.dataset.id;
        const contactId = event.currentTarget.dataset.contactid;

        try {
            await createHardwareTicket({
                contactId: contactId,
                hardwareId: hardwareId,
                description: 'System Upgrade Required'
            });
            await LightningAlert.open({
                message: 'Caution ticket for system upgrade raised successfully.',
                theme: 'success',
                label: 'Success'
            });
            this.loadTickets();
        } catch (error) {
            LightningAlert.open({
                message: error.body?.message || error.message,
                theme: 'error',
                label: 'Error'
            });
        }
    }

    handleEditHardwarePicSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.editImgObj = img;
                    this.editShowCropper = true;
                    this.editCropScale = 1;
                    this.editOffsetX = 0;
                    this.editOffsetY = 0;
                    setTimeout(() => this.drawEditCropCanvas(), 50);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    handleEditCropScale(event) {
        this.editCropScale = parseFloat(event.target.value);
        this.drawEditCropCanvas();
    }

    drawEditCropCanvas() {
        const canvas = this.template.querySelector('.edit-crop-canvas');
        if (!canvas || !this.editImgObj) return;
        const ctx = canvas.getContext('2d');
        const size = 200;
        
        ctx.clearRect(0, 0, size, size);
        
        const scaleX = size / this.editImgObj.width;
        const scaleY = size / this.editImgObj.height;
        const baseScale = Math.max(scaleX, scaleY);
        const finalScale = baseScale * this.editCropScale;
        
        const drawWidth = this.editImgObj.width * finalScale;
        const drawHeight = this.editImgObj.height * finalScale;
        
        const cx = (size - drawWidth) / 2 + this.editOffsetX;
        const cy = (size - drawHeight) / 2 + this.editOffsetY;
        
        ctx.drawImage(this.editImgObj, cx, cy, drawWidth, drawHeight);
    }

    handleEditCropDragStart(event) {
        this.editIsDragging = true;
        this.editStartX = event.clientX || (event.touches && event.touches[0].clientX);
        this.editStartY = event.clientY || (event.touches && event.touches[0].clientY);
    }

    handleEditCropDragMove(event) {
        if (!this.editIsDragging) return;
        event.preventDefault();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        
        this.editOffsetX += (clientX - this.editStartX);
        this.editOffsetY += (clientY - this.editStartY);
        
        this.editStartX = clientX;
        this.editStartY = clientY;
        this.drawEditCropCanvas();
    }

    handleEditCropDragEnd() {
        this.editIsDragging = false;
    }

    applyEditCrop() {
        const canvas = this.template.querySelector('.edit-crop-canvas');
        if (canvas) {
            this.editCroppedImageBase64 = canvas.toDataURL('image/png');
            this.editShowCropper = false;
        }
    }

    removeEditHardwarePic() {
        this.editCroppedImageBase64 = '';
        const fileInputs = this.template.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => input.value = '');
    }

    // ----- Requests Actions -----
    @track isRequestActionModalOpen = false;
    @track requestActionType = '';
    @track adminComment = '';
    selectedRequestId = null;

    handleRequestAction(event) {
        this.selectedRequestId = event.currentTarget.dataset.id;
        this.requestActionType = event.currentTarget.dataset.action;
        this.adminComment = '';
        this.isRequestActionModalOpen = true;
    }

    closeRequestActionModal() {
        this.isRequestActionModalOpen = false;
        this.selectedRequestId = null;
    }

    handleAdminCommentChange(event) {
        this.adminComment = event.target.value;
    }

    async submitRequestAction() {
        if (!this.adminComment) {
            this.showToast('Error', 'Admin Comment is required.', 'error');
            return;
        }

        let newStatus = '';
        let successMsg = '';

        if (this.requestActionType === 'Fulfill') {
            newStatus = 'Fulfilled';
            successMsg = 'Request marked as fulfilled. Assign hardware in the inventory tab!';
        } else if (this.requestActionType === 'Forward') {
            newStatus = 'Forwarded to HR/Manager';
            successMsg = 'Request forwarded to HR/Manager.';
        } else if (this.requestActionType === 'Reject') {
            newStatus = 'Rejected';
            successMsg = 'Request rejected.';
        }

        if (newStatus) {
            try {
                await updateRequestStatus({ 
                    requestId: this.selectedRequestId, 
                    newStatus: newStatus,
                    comment: this.adminComment,
                    role: 'Admin',
                    callerId: this.callerId
                });
                this.showToast('Success', successMsg, 'success');
                this.closeRequestActionModal();
                this.loadRequests();
            } catch (error) {
                this.showToast('Error', error.body?.message || error.message, 'error');
            }
        }
    }

    // ----- Ticketing Logic -----
    get hasTickets() {
        return this.ticketList && this.ticketList.length > 0;
    }

    async loadTickets() {
        this.ticketsLoading = true;
        try {
            const data = await getHardwareTickets({ callerId: this.callerId });
            this.ticketList = data.map(ticket => ({
                ...ticket,
                formattedDate: new Date(ticket.CreatedDate).toLocaleDateString(),
                isOpen: ticket.Status__c === 'Created Ticket' || ticket.Status__c === 'Forwarded to Admin',
                statusClass: (ticket.Status__c === 'Solved by Admin' || ticket.Status__c === 'Solved by HR/Manager') ? 'slds-badge slds-theme_success' : 
                             (ticket.Status__c === 'Created Ticket' || ticket.Status__c === 'Forwarded to Admin') ? 'slds-badge slds-theme_warning' : 'slds-badge slds-theme_info'
            }));
            this.filterTickets();
        } catch (error) {
            this.showToast('Error loading tickets', error.body?.message || error.message, 'error');
        } finally {
            this.ticketsLoading = false;
        }
    }

    @track isTicketActionModalOpen = false;
    @track ticketActionType = '';
    @track adminTicketNote = '';
    @track ticketSearchKey = '';
    @track filteredTickets = [];
    @track createNewRequest = false;
    @track newRequestHwType = '';
    selectedTicketId = null;

    get isResolveAction() {
        return this.ticketActionType === 'Resolve';
    }

    handleCreateNewRequestChange(event) {
        this.createNewRequest = event.target.checked;
    }

    handleNewRequestHwTypeChange(event) {
        this.newRequestHwType = event.target.value;
    }

    handleTicketSearch(event) {
        this.ticketSearchKey = event.target.value.toLowerCase();
        this.filterTickets();
    }

    filterTickets() {
        if (!this.ticketList) return;
        this.filteredTickets = this.ticketList.filter(ticket => 
            ticket.Employee__r?.Name?.toLowerCase().includes(this.ticketSearchKey) || 
            ticket.Hardware__r?.Name?.toLowerCase().includes(this.ticketSearchKey) ||
            ticket.Name?.toLowerCase().includes(this.ticketSearchKey)
        );
    }

    handleTicketAction(event) {
        this.selectedTicketId = event.currentTarget.dataset.id;
        this.ticketActionType = event.currentTarget.dataset.action;
        this.adminTicketNote = '';
        this.createNewRequest = false;
        this.newRequestHwType = '';
        this.isTicketActionModalOpen = true;
    }

    closeTicketActionModal() {
        this.isTicketActionModalOpen = false;
        this.selectedTicketId = null;
        this.createNewRequest = false;
        this.newRequestHwType = '';
    }

    handleAdminTicketNoteChange(event) {
        this.adminTicketNote = event.target.value;
    }

    async submitTicketAction() {
        if (!this.adminTicketNote) {
            this.showToast('Error', 'Admin Note is required.', 'error');
            return;
        }

        if (this.ticketActionType === 'Resolve' && this.createNewRequest && !this.newRequestHwType) {
            this.showToast('Error', 'Please select a hardware type for the new request.', 'error');
            return;
        }

        let newStatus = '';
        let successMsg = '';

        if (this.ticketActionType === 'Resolve') {
            newStatus = 'Solved by Admin';
            successMsg = 'Ticket solved by Admin.';
            if (this.createNewRequest) {
                successMsg = 'Ticket solved and new hardware request forwarded to HR.';
            }
        } else if (this.ticketActionType === 'ForwardHR') {
            newStatus = 'Forwarded to HR/Manager';
            successMsg = 'Ticket forwarded to HR/Manager.';
        } else if (this.ticketActionType === 'ForwardAdmin') {
            newStatus = 'Forwarded to Admin';
            successMsg = 'Ticket forwarded to Admin.';
        } else if (this.ticketActionType === 'Deliver') {
            newStatus = 'Hardware will be Delivered';
            successMsg = 'Hardware will be delivered.';
        }

        try {
            await updateTicketStatusWithRequest({ 
                ticketId: this.selectedTicketId, 
                newStatus: newStatus,
                comment: this.adminTicketNote,
                role: 'Admin',
                createRequest: this.createNewRequest,
                hwType: this.newRequestHwType,
                callerId: this.callerId
            });
            this.showToast('Success', successMsg, 'success');
            this.closeTicketActionModal();
            this.loadTickets();
            this.loadRequests();
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
