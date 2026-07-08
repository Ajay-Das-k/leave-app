import { LightningElement, track, wire, api } from 'lwc';
import submitLeaveRecord from '@salesforce/apex/LeaveController.createLeave';
import checkH1Limit from '@salesforce/apex/LeaveController.checkH1Limit';
import getLeaveTypes from '@salesforce/apex/LeaveController.getLeaveTypes';
import calculateLeaveDuration from '@salesforce/apex/LeaveController.calculateLeaveDuration';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningAlert from 'lightning/alert';
import LightningConfirm from 'lightning/confirm';
import LopWarningModal from 'c/lopWarningModal';

export default class LeaveRequest extends LightningElement {
    @api currentUser; // Receive from parent
    @track startDate;
    @track endDate;
    @track leaveTypeId;
    @track reason = '';
    @track leaveTypeOptions = [];
    
    @track isHalfDay = false;
    @track halfDaySession = 'FN'; // Default to Forenoon
    @track durationMessage = '';
    @track isCalculating = false;

    get sessionOptions() {
        return [
            { label: 'Forenoon (FN)', value: 'FN' },
            { label: 'Afternoon (AN)', value: 'AN' }
        ];
    }

    get minDate() {
        return new Date().toISOString().split('T')[0];
    }

    @wire(getLeaveTypes)
    wiredLeaveTypes({ error, data }) {
        if (data) {
            console.log('Leave Types:', data);
            
            // Show all leave types EXCEPT Work From Home
            this.leaveTypeOptions = data
                .filter(type => !type.Name.includes('Work From Home'))
                .map(type => ({
                    label: type.Name,
                    value: type.Id,
                    isProbationFriendly: type.Available_During_Probation__c
                }));
            
        } else if (error) {
            console.error('Error loading leave types:', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Error loading leave types',
                variant: 'error'
            }));
        }
    }

    handleStartDate(event) {
        this.startDate = event.target.value;
        if (this.isHalfDay) {
            this.endDate = this.startDate; // Keep in sync
            this.durationMessage = 'Selected: 0.5 Days';
        } else {
            this.calculateDuration();
        }
    }

    handleEndDate(event) {
        this.endDate = event.target.value;
        this.calculateDuration();
    }
    
    handleHalfDayChange(event) {
        this.isHalfDay = event.target.checked;
        if (this.isHalfDay) {
            this.halfDaySession = 'FN'; // Reset to default
            if (this.startDate) {
                this.endDate = this.startDate;
                this.durationMessage = 'Selected: 0.5 Days';
            } else {
                this.endDate = null;
                this.durationMessage = '';
            }
        } else {
            // Reset message to prompt re-calc or manual input
             if (this.startDate && this.endDate) {
                 this.calculateDuration();
             } else {
                 this.durationMessage = '';
             }
        }
    }

    handleSessionChange(event) {
        this.halfDaySession = event.detail.value;
    }

    calculateDuration() {
        if (!this.startDate || !this.endDate) {
            this.durationMessage = '';
            return;
        }
        
        if (new Date(this.startDate) > new Date(this.endDate)) {
            this.durationMessage = 'Error: End date before Start date';
            return;
        }

        this.isCalculating = true;
        this.durationMessage = 'Calculating...';

        calculateLeaveDuration({ startDate: this.startDate, endDate: this.endDate })
            .then(days => {
                console.log('Calculated Duration:', days);
                this.durationMessage = `Total Working Days: ${days}`;
            })
            .catch(error => {
                console.error('Error calc duration:', error);
                // Fallback basic calc if error
                this.durationMessage = '';
            })
            .finally(() => {
                this.isCalculating = false;
            });
    }



    handleLeaveType(event) {
        this.leaveTypeId = event.detail.value;
    }

    handleReason(event) {
        this.reason = event.target.value;
    }

    async submitLeave() {
        console.log('submitLeave called');
        
        // Validate form
        if (!this.startDate || !this.endDate || !this.leaveTypeId || !this.reason) {
            await LightningAlert.open({
                message: 'Please fill all required fields',
                theme: 'error',
                label: 'Error'
            });
            return;
        }

        // Prepare Date Objects
        const start = new Date(this.startDate);
        const end = new Date(this.endDate);
        const today = new Date();
        today.setHours(0,0,0,0); // Normalize today

        // 1. Past Date Validation
        // Allow today, block yesterday
        const startNormalized = new Date(start);
        startNormalized.setHours(0,0,0,0);
        
        if (startNormalized < today) {
             await LightningAlert.open({
                message: 'Leave Start Date cannot be in the past.',
                theme: 'error',
                label: 'Validation Error'
            });
            return;
        }

        if (start > end) {
            await LightningAlert.open({
                message: 'End date must be after start date',
                theme: 'error',
                label: 'Error'
            });
            return;
        }

        const selectedType = this.leaveTypeOptions.find(opt => opt.value === this.leaveTypeId);
        const leaveName = selectedType ? selectedType.label : '';

        // 2. Probation Logic Validation (Skip for Work From Home)
        if (this.currentUser && this.currentUser.isProbation && !leaveName.includes('Work From Home')) {
            // Generic Check from Metadata
            if (selectedType && !selectedType.isProbationFriendly) {
                await LightningAlert.open({
                    message: `Probation employees cannot apply for ${leaveName}`,
                    theme: 'warning',
                    label: 'Warning'
                });
                return;
            }

            // Explicit Hardcoded Check for Casual Leave
            if (leaveName.includes('Casual') || leaveName.includes('CL')) {
                 await LightningAlert.open({
                    message: 'Probation employees are not eligible for Casual Leave.',
                    theme: 'error',
                    label: 'Policy Restriction'
                });
                return;
            }
            
            // Permanent Only Leaves
            if (leaveName.includes('Marriage') || leaveName.includes('Paternity')) {
                 await LightningAlert.open({
                    message: `${leaveName} is available for Permanent Employees only.`,
                    theme: 'error',
                    label: 'Policy Restriction'
                });
                return;
            }
        }

        // 3. Gender Validation
        if (this.currentUser) {
            // Check gender for validation
            const genderRaw = this.currentUser.gender;
            const gender = genderRaw ? genderRaw.toLowerCase() : '';
            
             if (leaveName.includes('Maternity') && gender !== 'female') {
                await LightningAlert.open({
                    message: `Maternity Leave is applicable for Female employees only. (Your gender: ${genderRaw || 'Unknown'})`,
                    theme: 'error',
                    label: 'Policy Restriction'
                });
                return;
            }

            if (leaveName.includes('Paternity') && gender !== 'male') {
                await LightningAlert.open({
                    message: `Paternity Leave is applicable for Male employees only. (Your gender: ${genderRaw || 'Unknown'})`,
                    theme: 'error',
                    label: 'Policy Restriction'
                });
                return;
            }
        }

        // 4. Duration Validation (Max Days)
        // We need to calculate working days first if logic depends on it, but simple day count is faster for initial check
        // However, requirements usually imply "Calendar Days" or "Working Days". Let's assume Calendar Days for simplicty or use the calculated working days if available.
        // Let's use the helper to get simple day difference first for quick check
        const diffTime = Math.abs(end - start);
        const dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        // Bereavement: Max 5 Days
        if (leaveName.includes('Bereavement') && dayCount > 5) {
             await LightningAlert.open({
                message: 'Bereavement Leave cannot exceed 5 days.',
                theme: 'error',
                label: 'Policy Restriction'
            });
            return;
        }

        // Marriage: Max 5 Days
        if (leaveName.includes('Marriage') && dayCount > 5) {
             await LightningAlert.open({
                message: 'Marriage Leave cannot exceed 5 days.',
                theme: 'error',
                label: 'Policy Restriction'
            });
            return;
        }

        // Paternity: Max 21 Days (3 Weeks)
        if (leaveName.includes('Paternity') && dayCount > 21) {
             await LightningAlert.open({
                message: 'Paternity Leave cannot exceed 21 days (3 Weeks).',
                theme: 'error',
                label: 'Policy Restriction'
            });
            return;
        }

        // Prepare Reason (Append Half Day tag if needed)
        
        // Prepare Reason (Append Half Day tag if needed)
        let finalReason = this.reason;
        if (this.isHalfDay) {
            finalReason += ` (Half Day - ${this.halfDaySession})`;
        }



        try {
            this.isCalculating = true; // Block button

            // 1. Check Limits (First 6 Months)
            const isLimitExceeded = await checkH1Limit({
                startDate: this.startDate, 
                endDate: this.endDate, 
                leaveTypeId: this.leaveTypeId, 
                contactId: this.currentUser?.contactId
            });

            if (isLimitExceeded) {
                const result = await LopWarningModal.open({
                    size: 'small',
                    description: 'Loss of Pay Warning'
                });

                if (result !== 'ok') {
                    this.isCalculating = false;
                    return; // User Cancelled
                }
            }

            const result = await submitLeaveRecord({
                startDate: this.startDate,
                endDate: this.endDate,
                leaveTypeId: this.leaveTypeId,
                reason: finalReason,
                contactId: this.currentUser?.contactId
            });

            await LightningAlert.open({
                message: 'Leave request submitted successfully!',
                theme: 'info', 
                label: 'Success'
            });

            this.resetForm();
            this.dispatchEvent(new CustomEvent('leavesubmitted'));
            
        } catch(error) {
            console.error('Error in submitLeave:', error);
            await LightningAlert.open({
                message: error.body?.message || 'Failed to submit leave request',
                theme: 'error',
                label: 'Error'
            });
        } finally {
            this.isCalculating = false;
        }
    }

    resetForm() {
        this.startDate = '';
        this.endDate = '';
        this.leaveTypeId = '';
        this.reason = '';
        this.isHalfDay = false;
        this.durationMessage = '';

        // Clear all form inputs
        const inputs = this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'toggle') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }
}