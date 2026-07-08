import { LightningElement, track, wire, api } from 'lwc';
import getMyLeaves from '@salesforce/apex/LeaveController.getMyLeaves';
import getLeaveBalances from '@salesforce/apex/LeaveController.getLeaveBalances';
import deleteLeaveRequest from '@salesforce/apex/LeaveController.deleteLeaveRequest';
import deleteAllMyLeaves from '@salesforce/apex/LeaveController.deleteAllMyLeaves';
import { refreshApex } from '@salesforce/apex';
import updateEmployeeProfile from '@salesforce/apex/PaybookLoginController.updateEmployeeProfile';
import getContactDetails from '@salesforce/apex/PaybookLoginController.getContactDetails';
import getWFHTakenCount from '@salesforce/apex/LeaveController.getWFHTakenCount';
import getLOPCount from '@salesforce/apex/LeaveController.getLOPCount';
import getTeamStatus from '@salesforce/apex/LeaveController.getTeamStatus';  
import getUpcomingHolidays from '@salesforce/apex/LeaveController.getUpcomingHolidays';
import submitPartialCancellation from '@salesforce/apex/LeaveController.submitPartialCancellation'; // NEW IMPORT
import createHardwareRequest from '@salesforce/apex/HardwareController.createHardwareRequest';
import getEmployeeHardwareRequests from '@salesforce/apex/HardwareController.getEmployeeHardwareRequests';
import getEmployeeAssignedHardware from '@salesforce/apex/HardwareController.getEmployeeAssignedHardware';
import getEmployeeHardwareTickets from '@salesforce/apex/HardwareController.getEmployeeHardwareTickets';
import createHardwareTicket from '@salesforce/apex/HardwareController.createHardwareTicket';
import deleteHardwareTicket from '@salesforce/apex/HardwareController.deleteHardwareTicket';
import LightningConfirm from 'lightning/confirm';
import LightningAlert from 'lightning/alert';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class LeaveEmployeeDashboard extends LightningElement {
    @api currentUser; 
    @api hideHeader = false; 
    
    @track annualLeaveBal = 0;
    @track sickLeaveBal = 0;
    @track sickLeaveUsed = 0;
    @track casualLeaveBal = 0;
    @track casualLeaveUsed = 0;
    @track pendingCount = 0;
    @track myLeaves = [];
    @track userName = 'Employee'; 
    @track isLoading = false;
    @track errorMessage = null;
    @track wfhCount = 0;
    @track lopCount = 0;
    @track teamStatusData = [];
    @track upcomingHolidays = [];

    wiredHolidaysResult;
    @wire(getUpcomingHolidays)
    wiredHolidays(result) {
        this.wiredHolidaysResult = result;
        const { error, data } = result;
        if (data) {
            this.upcomingHolidays = data;
            this.upcomingHolidays = data;
            // this.generateCalendar(); // Moved to child
        } else if (error) {
            console.error('Error loading holidays', error);
        }
    }

    // Filtered holidays for the list (next 2 months)
    // List of all upcoming holidays (no 2-month filter)
    get displayHolidays() {
        return this.upcomingHolidays || [];
    }

    // Hardware State
    @track myHardwareRequests = [];
    @track myAssignedHardware = [];
    @track myHardwareTickets = [];
    @track isHardwareRequestModalOpen = false;
    @track hardwareType = '';
    @track hardwareDescription = '';
    @track isTicketModalOpen = false;
    @track ticketDescription = '';
    @track selectedHardwareIdForTicket = null;

    hardwareTypeOptions = [
        { label: 'Laptop', value: 'Laptop' },
        { label: 'Monitor', value: 'Monitor' },
        { label: 'Mouse', value: 'Mouse' },
        { label: 'Keyboard', value: 'Keyboard' },
        { label: 'Headset', value: 'Headset' },
        { label: 'Other', value: 'Other' }
    ];

    // Hardware Wires
    wiredHardwareRequestsResult;
    @wire(getEmployeeHardwareRequests, { contactId: '$currentUser.contactId' })
    wiredHardwareRequests(result) {
        this.wiredHardwareRequestsResult = result;
        if (result.data) {
            this.myHardwareRequests = result.data;
        } else if (result.error) {
            console.error('Error fetching hardware requests', result.error);
        }
    }

    wiredAssignedHardwareResult;
    @wire(getEmployeeAssignedHardware, { contactId: '$currentUser.contactId' })
    wiredAssignedHardware(result) {
        this.wiredAssignedHardwareResult = result;
        if (result.data) {
            this.myAssignedHardware = result.data;
        } else if (result.error) {
            console.error('Error fetching assigned hardware', result.error);
        }
    }

    wiredHardwareTicketsResult;
    @wire(getEmployeeHardwareTickets, { contactId: '$currentUser.contactId' })
    wiredHardwareTickets(result) {
        this.wiredHardwareTicketsResult = result;
        if (result.data) {
            this.myHardwareTickets = result.data.map(ticket => ({
                ...ticket,
                hardwareName: ticket.Hardware__r ? ticket.Hardware__r.Name : 'Deleted Hardware',
                hardwareImageUrl: ticket.Hardware__r ? ticket.Hardware__r.Image_URL__c : ''
            }));
        } else if (result.error) {
            console.error('Error fetching hardware tickets', result.error);
        }
    }

    // Calendar logic moved to c-calendar-widget
    
    // Call generateCalendar when holidays or leaves change
    // Using a getter or watching variables is hard in LWC without explicit update
    // We'll call it in the wire handlers and connectedCallback
   
    
    // Table Columns
    // Table Columns (Simpler)
    teamStatusColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Leave Type', fieldName: 'Status', type: 'text', 
          cellAttributes: { class: { fieldName: 'StatusColor' } } 
        }
    ];

    @track isProfileOpen = false;
    @track profileData = {};
    @track profileUpdates = {};
    
    get profileCompletion() {
        if (!this.profileData || Object.keys(this.profileData).length === 0) return 0;
        
        const fieldsToCheck = [
            'firstName', 'lastName', 'email', 'mobile',
            'department', 'birthdate', 'gender', 'address', 
            'guardianName', 'guardianPhone'
        ];
        
        let filledCount = 0;
        fieldsToCheck.forEach(field => {
            if (this.profileData[field] && String(this.profileData[field]).trim() !== '') {
                filledCount++;
            }
        });
        
        return Math.round((filledCount / fieldsToCheck.length) * 100);
    }
    
    get isProfileComplete() {
        return this.profileCompletion === 100;
    }
    
    wiredLeavesResult; 

    connectedCallback() {

        // Init profileData with passed currentUser so child components have basic data immediately
        if (this.currentUser) {
            this.profileData = { ...this.currentUser };
            if (this.currentUser.employeeName) {
                this.userName = this.currentUser.employeeName;
            }
            if (this.currentUser.contactId) {
                 this.fetchProfileDetails();
            }
        }
    }

    fetchProfileDetails() {
        getContactDetails({ contactId: this.currentUser.contactId })
            .then(result => {
                if (result.success) {
                    // Merge fresh data (including Gender) into profileData
                    this.profileData = { ...this.currentUser, ...result };
                    this.userName = result.employeeName;
                    console.log('Profile Data Loaded with Gender:', this.profileData.gender);
                }
            })
            .catch(error => console.error('Error fetching profile:', error));
    }

    wiredBalancesResult; // Stored for refresh
    wiredWFHResult; // Stored for refresh

    @wire(getLeaveBalances, { userId: '$currentUser.contactId' })
    wiredBalances(result) {
        this.wiredBalancesResult = result;
        const { error, data } = result;
        if (data) {
            // Helper to safely get Used and Remaining
            const getDetails = (typeNames) => {
                 for (let name of typeNames) {
                     if (data[name]) return data[name];
                 }
                 return { Used: 0, Remaining: 0 };
            };

            // Annual / Earned
            let annual = getDetails(['Annual Leave', 'Annual', 'Earned Leave', 'PL']);
            this.annualLeaveBal = annual.Remaining;

            // Sick
            let sick = getDetails(['Sick Leave', 'Sick', 'SL']);
            this.sickLeaveBal = sick.Remaining;
            this.sickLeaveUsed = sick.Used;

            // Casual
            let casual = getDetails(['Casual Leave', 'Casual', 'CL']);
            this.casualLeaveBal = casual.Remaining;
            this.casualLeaveUsed = casual.Used;
        } else if (error) {
            console.error('Error loading balances:', error);
        }
    }

    @wire(getWFHTakenCount, { userId: '$currentUser.contactId' })
    wiredWFH(result) {
        this.wiredWFHResult = result;
        const { error, data } = result;
        if (data !== undefined) {
             this.wfhCount = data;
        } else if (error) {
             console.error('Error loading WFH count:', error);
        }
    }

    wiredLOPResult;
    @wire(getLOPCount, { userId: '$currentUser.contactId' })
    wiredLOP(result) {
        this.wiredLOPResult = result;
        const { error, data } = result;
        if (data !== undefined) {
             this.lopCount = data;
        } else if (error) {
             console.error('Error loading LOP count:', error);
        }
    }

    // wiredTeamStatusResult;
    // @wire(getTeamStatus)
    // wiredTeamStatus(result) {
    //     this.wiredTeamStatusResult = result;
    //     if (result.data) {
    //         // Filter out 'Active' (present) employees, show only absentees
    //         this.teamStatusData = result.data.filter(emp => emp.Status !== 'Active');
    //     } else if (result.error) {
    //         console.error('Error loading team status:', result.error);
    //     }
    // }

    @wire(getMyLeaves, { userId: '$currentUser.contactId' })
    wiredLeaves(result) {
        this.wiredLeavesResult = result;
        const { error, data } = result;
        this.isLoading = false;
        
        if (data) {
            this.myLeaves = data.map(leave => {
                // Formatting for Display
                let displayId = leave.Name;
                // If Name looks like a Salesforce ID (starts with 'a' and long), make it pretty
                if (displayId && displayId.length >= 15 && displayId.startsWith('a')) {
                     displayId = 'LR-' + leave.Id.substring(leave.Id.length - 6).toUpperCase();
                }

                let status = leave.Status__c;
                let badgeClass = 'slds-badge';
                let formattedStatus = status;

                if (status === 'HR_Approved' || status === 'Approved') {
                    badgeClass += ' slds-theme_success';
                    formattedStatus = 'Approved';
                } else if (status === 'Submitted' || status === 'Pending HR Approval') {
                    badgeClass += ' slds-theme_warning';
                    formattedStatus = 'Pending';
                } else if (status.includes('Rejected')) {
                    badgeClass += ' slds-theme_error';
                    formattedStatus = 'Rejected';
                } else if (status === 'Cancelled') {
                    badgeClass += ' slds-theme_offline'; // Grey
                    formattedStatus = 'Cancelled';
                }

                return {
                    ...leave,
                    Name: displayId,
                    isDeletable: true,
                    isApproved: (formattedStatus === 'Approved'), // For UI Menu Logic
                    formattedStatus: formattedStatus,
                    badgeClass: badgeClass
                };
            });
            this.pendingCount = data.filter(l => l.Status__c === 'Submitted' || l.Status__c === 'Pending HR Approval').length;
            this.errorMessage = null;
            // this.generateCalendar(); // Moved to child
        } else if (error) {
            console.error('Error loading leaves:', error);
            this.errorMessage = 'Unable to load leave requests. Please refresh the page.';
            this.myLeaves = [];
        }
    }
    
    handleRefresh() {
        this.isLoading = true;
        return Promise.all([
            refreshApex(this.wiredLeavesResult),
            refreshApex(this.wiredBalancesResult),
            refreshApex(this.wiredWFHResult),
            refreshApex(this.wiredLOPResult),
            // refreshApex(this.wiredTeamStatusResult),
            refreshApex(this.wiredHolidaysResult)
        ])
            .then(() => {
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                console.error('Error refreshing dashboard:', error);
            });
    }
    
    async handleDeleteRequest(event) {
        // STANDARD LWC FIX: Use event.currentTarget.dataset.id
        // currentTarget refers to the component the listener is attached to (the button)
        // target refers to the element that was actually clicked (could be the svg icon inside)
        const leaveId = event.currentTarget.dataset.id;
        
        // DEBUG: Alert removed now that it is verified
        
        if (!leaveId) {
            await LightningAlert.open({
                message: 'Error: Could not identify the leave request to delete (ID missing).',
                theme: 'error',
                label: 'Error',
            });
            return;
        }

        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to delete this leave request?',
            variant: 'headerless',
            label: 'Confirm Deletion',
        });

        if (!confirmed) {
            return; // User clicked 'Cancel'
        }

        this.isLoading = true;
        deleteLeaveRequest({ leaveId: leaveId })
            .then(async () => {
                await LightningAlert.open({
                    message: 'Request deleted successfully.',
                    theme: 'success',
                    label: 'Success',
                });
                return this.handleRefresh();
            })
            .then(() => {
                 this.dispatchEvent(new CustomEvent('leavesubmitted')); 
            })
            .catch(async error => {
                console.error('Delete error:', error);
                await LightningAlert.open({
                    message: 'Error deleting request: ' + (error.body ? error.body.message : error.message),
                    theme: 'error',
                    label: 'Error',
                });
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // handleDeleteAll removed as requested

    async handleMenuSelect(event) {
        const action = event.detail.value;
        const leaveId = event.target.dataset.id;
        
        if (action === 'cancel') {
            // Re-use logic, but we need to mock the event object structure for handleDeleteRequest
            // Or just call delete logic directly. Let's call direct logic but carefully.
            // Actually, best to just trigger the existing handler with a constructed event
            this.handleDeleteRequest({ currentTarget: { dataset: { id: leaveId } } }); 
        } else if (action === 'partial') {
            this.openPartialCancelModal(leaveId);
        }
    }

    @track isPartialModalOpen = false;
    @track selectedLeave = null;
    @track partialEndDate = null;
    @track isHalfDay = false;

    // Hardware Modal state
    @track isHardwareModalOpen = false;
    @track hardwareRequest = { type: '', description: '' };
    hardwareTypeOptions = [
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
        { label: 'Accessory', value: 'Accessory' }
    ];
    
    openPartialCancelModal(leaveId) {
        const leave = this.myLeaves.find(l => l.Id === leaveId);
        if (leave) {
            this.selectedLeave = leave;
            this.isPartialModalOpen = true;
            this.partialEndDate = ''; // Reset
            this.isHalfDay = false; // Reset
        }
    }

    closePartialModal() {
        this.isPartialModalOpen = false;
        this.selectedLeave = {};
        this.partialEndDate = '';
        this.isHalfDay = false;
    }

    handleDateChange(event) {
        this.partialEndDate = event.target.value;
    }

    handleHalfDayChange(event) {
        this.isHalfDay = event.target.checked;
    }

    get partialMaxDate() {
        if (this.selectedLeave && this.selectedLeave.To_Date__c) {
            const d = new Date(this.selectedLeave.To_Date__c);
            if (!this.isHalfDay) {
                // If standard shorten, max is ToDate - 1
                d.setDate(d.getDate() - 1);
            }
            // If Half Day, max IS ToDate (converting last day to half)
            return d.toISOString().split('T')[0];
        }
        return '';
    }

    submitPartialCancellation() {
         if (!this.partialEndDate) {
             LightningAlert.open({
                message: 'Please select a new End Date.',
                theme: 'error',
                label: 'Validation Error',
            });
            return;
         }
         
         // Validate locally
         if (this.partialEndDate < this.selectedLeave.From_Date__c) {
              LightningAlert.open({
                message: 'New End Date cannot be before Start Date.',
                theme: 'error',
                label: 'Validation Error',
            });
            return;
         }

         this.isLoading = true;
         // Pass isHalfDay to Apex
         submitPartialCancellation({ 
             originalLeaveId: this.selectedLeave.Id, 
             newEndDate: this.partialEndDate,
             isHalfDay: this.isHalfDay 
         })
            .then(async () => {
                this.closePartialModal();
                await LightningAlert.open({
                    message: 'Request Submitted. Waiting for approval.',
                    theme: 'success',
                    label: 'Success',
                });
                return this.handleRefresh();
            })
            .catch(async error => {
                console.error('Partial cancel error:', error);
                await LightningAlert.open({
                    message: 'Error: ' + (error.body ? error.body.message : error.message),
                    theme: 'error',
                    label: 'Error',
                });
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    openProfile() {
        this.isProfileOpen = true;
        // The child component will handle data fetching on open if needed or we pass IDs
        // But since we using <c-user-profile-modal user-id={currentUser.contactId}> it will have the ID
        // The child component has an @api open() method if we want to trigger it specifically, 
        // OR we can just set isProfileOpen to true, relying on the child to fetch data in connectedCallback or whenever isOpen becomes true.
        // My implementation of child uses connectedCallback for fetch if isOpen is true, or uses @api open().
        // Let's use querySelector to call open() to be safe and ensure refresh.
        setTimeout(() => {
            const modal = this.template.querySelector('c-user-profile-modal');
            if (modal) {
                modal.open();
            }
        }, 0);
    }

    closeProfile() {
        this.isProfileOpen = false;
    }

    handleProfileUpdate(event) {
        // Child component successfully updated profile
        // We can update local session storage or just refresh local data
        // event.detail contains the new profile data
        const newProfileData = event.detail;
        
        // Update Session Storage if necessary for consistency across reloads
        if (this.currentUser) {
            const updatedUser = { ...this.currentUser, ...newProfileData };
            // Don't store password in session
            delete updatedUser.password; 
            sessionStorage.setItem('paybookUser', JSON.stringify(updatedUser));
            
            // Update local tracking
            this.profileData = updatedUser; // Update profileData
            this.userName = newProfileData.firstName + ' ' + newProfileData.lastName;
        }
    }

    // --- HARDWARE REQUEST MODAL HANDLERS ---
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Hardware Modal Handlers
    openHardwareRequestModal() {
        this.hardwareType = '';
        this.hardwareDescription = '';
        this.isHardwareRequestModalOpen = true;
    }

    closeHardwareRequestModal() {
        this.isHardwareRequestModalOpen = false;
    }

    handleHardwareTypeChange(event) {
        this.hardwareType = event.detail.value;
    }

    handleHardwareDescriptionChange(event) {
        this.hardwareDescription = event.target.value;
    }

    async submitHardwareRequest() {
        if (!this.hardwareType || !this.hardwareDescription) {
            this.showToast('Error', 'Please fill all required fields.', 'error');
            return;
        }
        try {
            await createHardwareRequest({ 
                contactId: this.currentUser.contactId, 
                hardwareType: this.hardwareType, 
                description: this.hardwareDescription 
            });
            this.showToast('Success', 'Hardware request submitted successfully.', 'success');
            this.closeHardwareRequestModal();
            refreshApex(this.wiredHardwareRequestsResult);
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        }
    }

    openRaiseIssueModal(event) {
        this.selectedHardwareIdForTicket = event.target.dataset.id;
        this.ticketDescription = '';
        this.isTicketModalOpen = true;
    }

    closeTicketModal() {
        this.isTicketModalOpen = false;
        this.selectedHardwareIdForTicket = null;
    }

    handleTicketDescriptionChange(event) {
        this.ticketDescription = event.target.value;
    }

    async submitHardwareTicket() {
        if (!this.ticketDescription) {
            this.showToast('Error', 'Please describe the issue.', 'error');
            return;
        }
        try {
            await createHardwareTicket({ 
                contactId: this.currentUser.contactId, 
                hardwareId: this.selectedHardwareIdForTicket, 
                description: this.ticketDescription 
            });
            this.showToast('Success', 'Hardware ticket submitted successfully.', 'success');
            this.closeTicketModal();
            refreshApex(this.wiredHardwareTicketsResult);
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        }
    }

    async handleDeleteTicket(event) {
        const ticketId = event.target.dataset.id;
        const result = await LightningConfirm.open({
            message: 'Are you sure you want to delete this ticket?',
            variant: 'headerless',
            label: 'Delete Ticket'
        });
        
        if (result) {
            try {
                await deleteHardwareTicket({ ticketId });
                this.showToast('Success', 'Hardware ticket deleted successfully.', 'success');
                refreshApex(this.wiredHardwareTicketsResult);
            } catch (error) {
                this.showToast('Error', error.body?.message || error.message, 'error');
            }
        }
    }
}