import { LightningElement, track, wire, api } from 'lwc';
import getHRColleagueLeaves from '@salesforce/apex/LeaveController.getHRColleagueLeaves';
import approveLeaveByHR from '@salesforce/apex/LeaveController.approveLeaveByHR';
import rejectLeaveRequest from '@salesforce/apex/LeaveController.rejectLeaveRequest';
import getHRStats from '@salesforce/apex/LeaveController.getHRStats';
import getTeamStatus from '@salesforce/apex/LeaveController.getTeamStatus';
import getTeamAnalytics from '@salesforce/apex/LeaveController.getTeamAnalytics'; // NEW
import getLeavesByDateRange from '@salesforce/apex/LeaveController.getLeavesByDateRange';
import getLeavesByDateRangeAndStatus from '@salesforce/apex/LeaveController.getLeavesByDateRangeAndStatus'; // NEW
import getEmployees from '@salesforce/apex/LeaveController.getEmployees'; // NEW
import createLeaveByHR from '@salesforce/apex/LeaveController.createLeaveByHR'; // NEW
import getLeaveTypes from '@salesforce/apex/LeaveController.getLeaveTypes'; // Reuse existing if available, else standard wire
import getContactDetails from '@salesforce/apex/PaybookLoginController.getContactDetails';
import getAllEmployees from '@salesforce/apex/PaybookLoginController.getAllEmployees';
import toggleEmployeeStatus from '@salesforce/apex/PaybookLoginController.toggleEmployeeStatus';
import makeEmployeePermanent from '@salesforce/apex/PaybookLoginController.makeEmployeePermanent';
import updateEmployeePosition from '@salesforce/apex/PaybookLoginController.updateEmployeePosition';
import getUpcomingHolidays from '@salesforce/apex/LeaveController.getUpcomingHolidays'; // NEW
import getHardwareRequests from '@salesforce/apex/HardwareController.getHardwareRequests';
import getHardwareInventory from '@salesforce/apex/HardwareController.getHardwareInventory'; // NEW
import updateRequestStatus from '@salesforce/apex/HardwareController.updateRequestStatus';
import getHardwareTickets from '@salesforce/apex/HardwareController.getHardwareTickets';
import updateTicketStatus from '@salesforce/apex/HardwareController.updateTicketStatus';
import createHardwareRequest from '@salesforce/apex/HardwareController.createHardwareRequest';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import LightningConfirm from 'lightning/confirm';
import LightningAlert from 'lightning/alert';

export default class LeaveHRDashboard extends LightningElement {
    _currentUser;
    @track hrIdParam;

    @api
    get currentUser() {
        return this._currentUser;
    }
    set currentUser(value) {
        this._currentUser = value;
        if (value && value.contactId) {
            this.hrIdParam = value.contactId;
            // Also fetch profile
            this.fetchProfile();
            // Load escalated requests/tickets
            this.loadEscalatedRequests();
            this.loadEscalatedTickets();
        }
    }
    @track userName = 'HR Admin';
    @track profileUpdates = {};
    @track profileData = {};

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
    @track isProfileOpen = false;
    @track isAddEmployeeOpen = false;

    // Tab State
    @track activeTab = 'personal_view'; 

    // --- DATA Properties ---
    @track teamStatusData = [];
    @track analyticsData = []; 
    @track filteredAnalytics = []; 
    @track filteredReports = []; 
    @track pendingLeaves = [];

    // Hardware Management State
    @track escalatedRequests = [];
    @track escalatedTickets = [];
    @track solvedRequests = [];
    @track solvedTickets = [];

    // HR Hardware Request Modal State
    @track isHRHardwareRequestModalOpen = false;
    @track hrHardwareSelectedEmployee;
    @track hrHardwareSelectedType;
    @track hrHardwareSelectedDescription = '';

    hrHardwareTypeOptions = [
        { label: 'Laptop', value: 'Laptop' },
        { label: 'Monitor', value: 'Monitor' },
        { label: 'Keyboard', value: 'Keyboard' },
        { label: 'Mouse', value: 'Mouse' },
        { label: 'Headset', value: 'Headset' },
        { label: 'UPS', value: 'UPS' },
        { label: 'CPU', value: 'CPU' },
        { label: 'RAM', value: 'RAM' },
        { label: 'SSD', value: 'SSD' },
        { label: 'Graphic Card', value: 'Graphic Card' },
        { label: 'Network Hardware', value: 'Network Hardware' }
    ];

    // Hardware Report State
    @track hardwareData = [];
    @track filteredHardware = [];
    @track filteredUserWise = [];
    @track hardwareSearchKey = '';
    @track selectedHwType = 'All';
    @track selectedHwStatus = 'All';
    @track hardwareViewMode = 'all';
    @track hardwareLoading = false;

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
        { label: 'Other', value: 'Other' }
    ];

    statusOptions = [
        { label: 'Available', value: 'Available' },
        { label: 'Assigned', value: 'Assigned' },
        { label: 'Under Maintenance', value: 'Under Maintenance' },
        { label: 'Retired', value: 'Retired' }
    ];

    @track isHwRequestModalOpen = false;
    @track hwRequestActionType = '';
    @track hwComment = '';
    selectedHwRequestId = null;

    @track isHwTicketModalOpen = false;
    @track hwTicketActionType = '';
    @track hwTicketNote = '';
    selectedHwTicketId = null;
    
    // Employee Tab State
    @track allEmployees = [];
    @track isEmployeeDetailModalOpen = false;
    @track selectedEmployeeDetail = {};
    @track isEmployeeUpdating = false;
    @track selectedPositions = [];

    positionOptions = [
        { label: 'CEO', value: 'CEO' }, { label: 'CTO', value: 'CTO' }, { label: 'CIO', value: 'CIO' },
        { label: 'COO', value: 'COO' }, { label: 'CFO', value: 'CFO' }, { label: 'CISO', value: 'CISO' },
        { label: 'VP of Engineering', value: 'VP of Engineering' }, { label: 'VP of Product', value: 'VP of Product' },
        { label: 'VP of Sales', value: 'VP of Sales' }, { label: 'Director of Engineering', value: 'Director of Engineering' },
        { label: 'Director of Product', value: 'Director of Product' }, { label: 'Director of Sales', value: 'Director of Sales' },
        { label: 'Engineering Manager', value: 'Engineering Manager' }, { label: 'Development Manager', value: 'Development Manager' },
        { label: 'Project Manager', value: 'Project Manager' }, { label: 'Product Manager', value: 'Product Manager' }, { label: 'Product Owner', value: 'Product Owner' },
        { label: 'Program Manager', value: 'Program Manager' }, { label: 'Delivery Manager', value: 'Delivery Manager' },
        { label: 'Team Lead', value: 'Team Lead' }, { label: 'Technical Lead', value: 'Technical Lead' },
        { label: 'Scrum Master', value: 'Scrum Master' }, { label: 'Software Engineer', value: 'Software Engineer' },
        { label: 'Software Developer', value: 'Software Developer' }, { label: 'Frontend Developer', value: 'Frontend Developer' },
        { label: 'Backend Developer', value: 'Backend Developer' }, { label: 'Full Stack Developer', value: 'Full Stack Developer' },
        { label: 'Mobile App Developer', value: 'Mobile App Developer' }, { label: 'Web Developer', value: 'Web Developer' },
        { label: 'Salesforce Developer', value: 'Salesforce Developer' }, { label: 'Salesforce Technical Lead', value: 'Salesforce Technical Lead' },
        { label: 'DevOps Engineer', value: 'DevOps Engineer' }, { label: 'Site Reliability Engineer (SRE)', value: 'Site Reliability Engineer (SRE)' },
        { label: 'Solution Architect', value: 'Solution Architect' }, { label: 'Enterprise Architect', value: 'Enterprise Architect' },
        { label: 'Technical Architect', value: 'Technical Architect' }, { label: 'Cloud Architect', value: 'Cloud Architect' },
        { label: 'Salesforce Architect', value: 'Salesforce Architect' }, { label: 'QA Engineer', value: 'QA Engineer' },
        { label: 'QA Analyst', value: 'QA Analyst' }, { label: 'Automation Test Engineer', value: 'Automation Test Engineer' },
        { label: 'Manual Test Engineer', value: 'Manual Test Engineer' }, { label: 'Performance Test Engineer', value: 'Performance Test Engineer' },
        { label: 'Data Analyst', value: 'Data Analyst' }, { label: 'Data Engineer', value: 'Data Engineer' },
        { label: 'Data Scientist', value: 'Data Scientist' }, { label: 'Machine Learning Engineer', value: 'Machine Learning Engineer' },
        { label: 'AI Engineer', value: 'AI Engineer' }, { label: 'Business Intelligence (BI) Developer', value: 'Business Intelligence (BI) Developer' },
        { label: 'Cloud Engineer', value: 'Cloud Engineer' }, { label: 'System Administrator', value: 'System Administrator' },
        { label: 'Network Administrator', value: 'Network Administrator' }, { label: 'Database Administrator (DBA)', value: 'Database Administrator (DBA)' },
        { label: 'Infrastructure Engineer', value: 'Infrastructure Engineer' }, { label: 'Platform Engineer', value: 'Platform Engineer' },
        { label: 'Security Engineer', value: 'Security Engineer' }, { label: 'Security Analyst', value: 'Security Analyst' },
        { label: 'Security Consultant', value: 'Security Consultant' }, { label: 'Penetration Tester', value: 'Penetration Tester' },
        { label: 'SOC Analyst', value: 'SOC Analyst' }, { label: 'UI Designer', value: 'UI Designer' },
        { label: 'UX Designer', value: 'UX Designer' }, { label: 'UI/UX Designer', value: 'UI/UX Designer' },
        { label: 'Graphic Designer', value: 'Graphic Designer' }, { label: 'Multimedia Content Creator', value: 'Multimedia Content Creator' },
        { label: 'Motion Graphics Designer', value: 'Motion Graphics Designer' }, { label: 'Video Editor', value: 'Video Editor' },
        { label: 'Business Analyst', value: 'Business Analyst' }, { label: 'Technical Consultant', value: 'Technical Consultant' },
        { label: 'Functional Consultant', value: 'Functional Consultant' }, { label: 'Salesforce Consultant', value: 'Salesforce Consultant' },
        { label: 'Technical Support Engineer', value: 'Technical Support Engineer' }, { label: 'Customer Success Manager', value: 'Customer Success Manager' },
        { label: 'Account Manager', value: 'Account Manager' }, { label: 'Sales Executive', value: 'Sales Executive' },
        { label: 'Sales Manager', value: 'Sales Manager' }, { label: 'Pre-Sales Engineer', value: 'Pre-Sales Engineer' },
        { label: 'Solution Consultant', value: 'Solution Consultant' }, { label: 'HR Executive', value: 'HR Executive' },
        { label: 'HR Manager', value: 'HR Manager' }, { label: 'Recruiter', value: 'Recruiter' },
        { label: 'Talent Acquisition Specialist', value: 'Talent Acquisition Specialist' }, { label: 'Office Administrator', value: 'Office Administrator' },
        { label: 'Marketing Executive', value: 'Marketing Executive' }, { label: 'Digital Marketing Specialist', value: 'Digital Marketing Specialist' },
        { label: 'SEO Specialist', value: 'SEO Specialist' }, { label: 'Content Writer', value: 'Content Writer' },
        { label: 'Social Media Manager', value: 'Social Media Manager' }, { label: 'Accountant', value: 'Accountant' },
        { label: 'Finance Manager', value: 'Finance Manager' }, { label: 'Intern', value: 'Intern' },
        { label: 'Software Engineer Trainee', value: 'Software Engineer Trainee' }, { label: 'Graduate Trainee', value: 'Graduate Trainee' },
        { label: 'Associate Software Engineer', value: 'Associate Software Engineer' }, { label: 'Junior Developer', value: 'Junior Developer' }
    ];

    // Mark Leave State
    @track employeeOptions = [];
    @track leaveTypeOptions = [];
    @track selectedEmployeeId;
    @track selectedLeaveTypeId;
    @track markFromDate;
    @track markToDate;
    @track markReason = '';
    @track isHalfDay = false; // New Half Day Checkbox
    @track halfDaySession = 'FN';

    get sessionOptions() {
        return [
            { label: 'Forenoon (FN)', value: 'FN' },
            { label: 'Afternoon (AN)', value: 'AN' }
        ];
    }

    // Filters
    @track analyticsSearchKey = ''; 
    @track reportSearchKey = '';    
    @track reportStartDate;
    @track reportEndDate;

    // Wire Results
    wiredPendingResult;
    wiredStatsResult;
    wiredTeamStatusResult;
    wiredAnalyticsResult;

    // ... (Columns skipped for brevity, keeping same) ...
    // 1. Team Status
    teamStatusColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Leave Type', fieldName: 'Status', type: 'text', 
          cellAttributes: { class: { fieldName: 'StatusColor' } } 
        }
    ];

    // 2. Team Insights (Analytics View)
    analyticsColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', sortable: true },
        { label: 'Total Leaves (YTD)', fieldName: 'TotalTaken', type: 'number', cellAttributes: { alignment: 'center' } },
        { label: 'WFH Taken', fieldName: 'WFHDays', type: 'number', cellAttributes: { alignment: 'center' } },
        { label: 'LoP Days', fieldName: 'LOPDays', type: 'number', cellAttributes: { alignment: 'center' } },
        { label: 'Sick Bal', fieldName: 'SickBal', type: 'number', cellAttributes: { alignment: 'center' } },
        { label: 'Casual Bal', fieldName: 'CasualBal', type: 'number', cellAttributes: { alignment: 'center' } }
    ];

    // 3. Reports (Detailed View)
    reportColumns = [
        { label: 'Name', fieldName: 'employeeName', type: 'text' },
        { label: 'Leave Type', fieldName: 'leaveType', type: 'text' },
        { label: 'From', fieldName: 'From_Date__c', type: 'date', typeAttributes: { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit' } },
        { label: 'To', fieldName: 'To_Date__c', type: 'date', typeAttributes: { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit' } },
        { label: 'Days', fieldName: 'Number_of_Days__c', type: 'number' },
        { label: 'Status', fieldName: 'Status__c', type: 'text' },
        { label: 'Reason', fieldName: 'Reason__c', type: 'text' }
    ];
    
    // 4. Employees List
    employeeColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Email', fieldName: 'Email', type: 'email' },
        { label: 'Department', fieldName: 'Department__c', type: 'text' },
        { label: 'Status', fieldName: 'StatusBadge', type: 'text', cellAttributes: { class: { fieldName: 'StatusBadgeColor' } } },
        { type: 'button', typeAttributes: { label: 'View Details', name: 'view_details', variant: 'base' } }
    ];

    // --- WIRES ---
    @track totalRequests = 0;
    @track approvedCount = 0;
    @track rejectedCount = 0;
    @track cancelledCount = 0;
    @track pendingCount = 0;

    // --- POPUP MODALS ---
    @track isApprovedModalOpen = false;
    @track isCancelledModalOpen = false;
    @track isRejectedModalOpen = false;
    @track approvedLeavesList = [];
    @track rejectedLeavesList = [];

    get totalRejectedDays() {
        return this.rejectedLeavesList.reduce((total, leave) => {
            return total + (leave.Number_of_Days__c || 0);
        }, 0);
    }
    
    // Computed property for total approved days
    get totalApprovedDays() {
        return this.approvedLeavesList.reduce((total, leave) => {
            return total + (leave.Number_of_Days__c || 0);
        }, 0);
    }
    
    get totalCancelledDays() {
        return this.cancelledLeavesList.reduce((total, leave) => {
            return total + (leave.Number_of_Days__c || 0);
        }, 0);
    }
    @track cancelledLeavesList = [];

    // --- LIFECYCLE ---
    connectedCallback() {
        if (this.currentUser) {
            this.fetchProfile();
            if (this.currentUser.employeeName) this.userName = this.currentUser.employeeName;
        }

        // Default Report Range
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        this.reportStartDate = firstDay.toISOString().split('T')[0];
        this.reportEndDate = lastDay.toISOString().split('T')[0];
        
        this.fetchReportData();
        this.fetchDashboardData();
    }

    // --- WIRES ---
    
    wiredEmployeesResult;
    // Wire Employees for Dropdown
    @wire(getEmployees, { callerId: '$hrIdParam' })
    wiredEmployees(result) {
        this.wiredEmployeesResult = result;
        if (result.data) {
            this.employeeOptions = result.data;
        } else if (result.error) {
            console.error('Error fetching employees', result.error);
        }
    }

    openAddEmployee() {
        if (this.wiredEmployeesResult) {
            refreshApex(this.wiredEmployeesResult).catch(err => console.error('Error refreshing employees on open:', err));
        }
        this.isAddEmployeeOpen = true;
    }

    closeAddEmployee() {
        this.isAddEmployeeOpen = false;
    }

    handleAddEmployeeSuccess() {
        if (this.wiredEmployeesResult) {
            refreshApex(this.wiredEmployeesResult).catch(err => console.error('Error refreshing employees:', err));
        }
        if (this.wiredAnalyticsResult) {
            refreshApex(this.wiredAnalyticsResult).catch(err => console.error('Error refreshing analytics:', err));
        }
    }
    
    // Wire Leave Types (Reusing Controller method if exists, assuming standard pattern)
    // NOTE: If LeaveController doesn't have getLeaveTypes exposed as cacheable public list, we might need to add it or fetch differently.
    // For now assuming getLeaveTypes returns [{label, value}] or similar. 
    // Actually, let's assume we need to fetch it.
    @wire(getLeaveTypes)
    wiredLeaveTypes({ data, error }) {
        if (data) {
             // Adapt if necessary, but usually returns {label, val}
             // Checking usual implementation: typically returns list of Leave_Type__c.
             // We map it:
             this.leaveTypeOptions = data.map(lt => ({ label: lt.Name, value: lt.Id }));
        }
    }

    // ... (Other wires: Pending, Stats, TeamStatus, Analytics - keeping same) ...
    @wire(getHRColleagueLeaves, { hrId: '$hrIdParam' })
    wiredPendingLeaves(result) {
        this.wiredPendingResult = result;
        if (result.data) {
            this.pendingLeaves = result.data.map(l => {
                let empName = l.Employee__r ? l.Employee__r.Name : 'Deleted Employee';
                let init = empName ? empName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'U';
                return { 
                    ...l, 
                    contactName: empName, 
                    profilePicUrl: l.Employee__r ? l.Employee__r.Profile_Picture_URL__c : '',
                    initials: init,
                    LeaveType: l.Leave_Type__r ? l.Leave_Type__r.Name : '',
                    isCancellation: l.Status__c === 'Cancellation Requested',
                    approveActionLabel: l.Status__c === 'Cancellation Requested' ? 'Confirm Cancel' : 'Approve'
                };
            });
        }
    }
    
    @wire(getHRStats, { callerId: '$hrIdParam' })
    wiredStats(result) {
        this.wiredStatsResult = result;
        if (result.data) {
            this.totalRequests = result.data.totalRequests;
            this.approvedCount = result.data.approvedCount;
            this.rejectedCount = result.data.rejectedCount;
            this.cancelledCount = result.data.cancelledCount;
            this.pendingCount = result.data.pendingCount;
        }
    }

    @wire(getTeamStatus, { callerId: '$hrIdParam' })
    wiredTeamStatus(result) {
        this.wiredTeamStatusResult = result;
        if (result.data) this.teamStatusData = result.data;
    }

    @wire(getTeamAnalytics, { callerId: '$hrIdParam' })
    wiredAnalytics(result) {
        this.wiredAnalyticsResult = result;
        if (result.data) {
            this.analyticsData = result.data;
            this.filterAnalytics();
        }
    }

    // --- HANDLERS (Search/Filter/Reports/Approvals) ---
    // ... (Keeping existing handlers) ...

    fetchDashboardData() {
        if (!this.currentUser || !this.currentUser.contactId) return;

        getHRStats({ callerId: this.currentUser.contactId })
            .then(result => {
                this.pendingCount = result.pending;
                this.approvedCount = result.approved;
                this.rejectedCount = result.rejected;
                this.cancelledCount = result.cancelled;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to fetch HR stats: ' + (error.body ? error.body.message : error.message), 'error');
            });
            
        if (this.wiredPendingResult) refreshApex(this.wiredPendingResult);
        if (this.wiredTeamStatusResult) refreshApex(this.wiredTeamStatusResult);
        this.loadEscalatedRequests();
        this.loadEscalatedTickets();
    }

    get hasEscalatedRequests() {
        return this.escalatedRequests && this.escalatedRequests.length > 0;
    }

    get hasEscalatedTickets() {
        return this.escalatedTickets && this.escalatedTickets.length > 0;
    }

    get hasSolvedRequests() {
        return this.solvedRequests && this.solvedRequests.length > 0;
    }

    get hasSolvedTickets() {
        return this.solvedTickets && this.solvedTickets.length > 0;
    }

    loadEscalatedRequests() {
        if (!this.currentUser) return;
        getHardwareRequests({ callerId: this.currentUser.contactId })
            .then(result => {
                this.escalatedRequests = result.filter(r => r.Status__c === 'Pending HR/Manager' || r.Status__c === 'Escalated to Manager' || r.Status__c === 'Pending Manager' || r.Status__c === 'Forwarded to HR/Manager');
                this.solvedRequests = result.filter(r => r.Status__c === 'Approved' || r.Status__c === 'Rejected' || r.Status__c === 'Fulfilled').map(r => ({
                    ...r,
                    formattedDate: new Date(r.CreatedDate).toLocaleDateString(),
                    isDeliverable: r.Status__c === 'Approved'
                }));
            })
            .catch(error => {
                console.error('Error fetching hardware requests:', error);
            });
    }

    loadEscalatedTickets() {
        if (!this.currentUser) return;
        getHardwareTickets({ callerId: this.currentUser.contactId })
            .then(result => {
                this.escalatedTickets = result.filter(t => t.Status__c === 'Forwarded to HR/Manager').map(t => ({
                    ...t,
                    isResolvedByAdmin: false,
                    adminName: ''
                }));
                this.solvedTickets = result.filter(t => t.Status__c === 'Solved by Admin' || t.Status__c === 'Solved by HR/Manager' || t.Status__c === 'Hardware will be Delivered').map(t => ({
                    ...t,
                    formattedDate: new Date(t.CreatedDate).toLocaleDateString()
                }));
            })
            .catch(error => {
                console.error('Error fetching hardware tickets:', error);
            });
    }

    async handleDeliverRequest(event) {
        const reqId = event.target.dataset.id;
        try {
            await updateRequestStatus({ 
                requestId: reqId, 
                newStatus: 'Fulfilled', 
                comment: 'Hardware delivered by HR Manager', 
                role: 'HRManager',
                callerId: this.currentUser.contactId
            });
            this.showToast('Success', 'Hardware marked as Delivered.', 'success');
            this.loadEscalatedRequests();
        } catch (error) {
            this.showToast('Error', error.body ? error.body.message : error.message, 'error');
        }
    }

    openRequestModal(event) {
        this.selectedHwRequestId = event.currentTarget.dataset.id;
        this.hwRequestActionType = event.currentTarget.dataset.action;
        this.hwComment = '';
        this.isHwRequestModalOpen = true;
    }

    closeHwRequestModal() {
        this.isHwRequestModalOpen = false;
        this.selectedHwRequestId = null;
    }

    handleHwCommentChange(event) {
        this.hwComment = event.target.value;
    }

    async submitHwRequestAction() {
        if (!this.hwComment) {
            this.showToast('Error', 'Comment is required.', 'error');
            return;
        }
        try {
            const newStatus = this.hwRequestActionType === 'Approve' ? 'Approved' : 'Rejected';
            await updateRequestStatus({ requestId: this.selectedHwRequestId, newStatus: newStatus, comment: this.hwComment, role: 'HRManager', callerId: this.currentUser.contactId });
            this.showToast('Success', `Hardware request ${newStatus.toLowerCase()} successfully.`, 'success');
            this.closeHwRequestModal();
            this.loadEscalatedRequests();
        } catch (error) {
            this.showToast('Error', error.body ? error.body.message : error.message, 'error');
        }
    }

    openTicketModal(event) {
        this.selectedHwTicketId = event.currentTarget.dataset.id;
        this.hwTicketActionType = event.currentTarget.dataset.action;
        this.hwTicketNote = '';
        this.isHwTicketModalOpen = true;
    }

    closeHwTicketModal() {
        this.isHwTicketModalOpen = false;
        this.selectedHwTicketId = null;
    }

    handleHwTicketNoteChange(event) {
        this.hwTicketNote = event.target.value;
    }

    async submitHwTicketAction() {
        if (!this.hwTicketNote) {
            this.showToast('Error', 'Note is required.', 'error');
            return;
        }
        try {
            await updateTicketStatus({ ticketId: this.selectedHwTicketId, newStatus: 'Solved by HR/Manager', comment: this.hwTicketNote, role: 'HRManager', callerId: this.currentUser.contactId });
            this.showToast('Success', 'Ticket resolved successfully.', 'success');
            this.closeHwTicketModal();
            this.loadEscalatedTickets();
        } catch (error) {
            this.showToast('Error', error.body ? error.body.message : error.message, 'error');
        }
    }

    handleAnalyticsSearch(event) {
        this.analyticsSearchKey = event.target.value.toLowerCase();
        this.filterAnalytics();
    }

    filterAnalytics() {
        if (!this.analyticsData) return;
        this.filteredAnalytics = this.analyticsData.filter(row => 
            row.Name.toLowerCase().includes(this.analyticsSearchKey)
        );
    }
    
    handleReportSearch(event) {
        this.reportSearchKey = event.target.value.toLowerCase();
        this.filterReports(); 
    }

    handleDateChange(event) {
        const field = event.target.name;
        if (field === 'startDate') this.reportStartDate = event.target.value;
        if (field === 'endDate') this.reportEndDate = event.target.value;
    }

    fetchReportData() {
        if (!this.reportStartDate || !this.reportEndDate) return;
        getLeavesByDateRange({ startDate: this.reportStartDate, endDate: this.reportEndDate, callerId: this.currentUser.contactId })
            .then(data => {
                this.rawReportData = data.map(leave => ({
                    ...leave,
                    employeeName: leave.Employee__r ? leave.Employee__r.Name : '',
                    leaveType: leave.Leave_Type__r ? leave.Leave_Type__r.Name : ''
                }));
                this.filterReports();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to fetch report data', 'error');
            });
    }

    filterReports() {
        if (!this.rawReportData) return;
        this.filteredReports = this.rawReportData.filter(row => 
            row.employeeName.toLowerCase().includes(this.reportSearchKey)
        );
    }

    handleDownloadReport() {
        try {
            if (!this.filteredReports || this.filteredReports.length === 0) {
                this.showToast('Info', 'No data to export', 'info');
                return;
            }

            // Clone data to avoid Proxy issues
            const dataToExport = JSON.parse(JSON.stringify(this.filteredReports));
            console.log('Exporting rows:', dataToExport.length);

            const headers = ['Name', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Reason'];
            let csv = headers.join(',') + '\n';
            
            dataToExport.forEach(row => {
                const name = row.employeeName ? row.employeeName.replace(/,/g, ' ') : '';
                const type = row.leaveType ? row.leaveType.replace(/,/g, ' ') : '';
                const from = row.From_Date__c || '';
                const to = row.To_Date__c || '';
                const days = row.Number_of_Days__c || 0;
                const status = row.Status__c ? row.Status__c.replace(/,/g, ' ') : '';
                const reason = row.Reason__c ? row.Reason__c.replace(/,/g, ' ').replace(/\n/g, ' ') : ''; 
                
                csv += `"${name}","${type}","${from}","${to}","${days}","${status}","${reason}"\n`;
            });

            // Add BOM
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/plain' });
            const link = document.createElement("a");
            
            const filename = `Leave_Report.csv`;

            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, filename);
            } else {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            console.error('Export Error:', e);
            this.showToast('Error', 'Failed to download report: ' + e.message, 'error');
        }
    }

    handleCommentChange(event) {
        const id = event.target.dataset.id;
        this.leaveComments[id] = event.target.value;
    }
    leaveComments = {};

    async handleApprove(event) { await this.processAction(event.target.dataset.id, 'Approve'); }
    async handleReject(event) { await this.processAction(event.target.dataset.id, 'Reject'); }

    async processAction(id, action) {
        this.isLoading = true;
        try {
            const comment = this.leaveComments[id] || '';
            if (action === 'Approve') {
                await approveLeaveByHR({ leaveId: id, comment: comment, hrId: this.currentUser.contactId });
                this.showToast('Success', 'Leave Approved Successfully', 'success');
            } else if (action === 'Reject') {
                await rejectLeaveRequest({ leaveId: id, comment: comment, callerId: this.currentUser.contactId });
                this.showToast('Success', 'Leave Rejected Successfully', 'success');
            }
            
            // Remove from local list to update UI immediately
            if (this.pendingLeaves) {
                this.pendingLeaves = this.pendingLeaves.filter(leave => leave.Id !== id);
            }
            
            // Trigger Apex Refresh
            Promise.all([
                refreshApex(this.wiredPendingResult),
                refreshApex(this.wiredStatsResult),
                refreshApex(this.wiredTeamStatusResult)
            ]).catch(err => console.error('Error refreshing dashboard data:', err));
            
        } catch (error) {
            console.error('Error processing action:', error);
            this.showToast('Error', 'Action failed: ' + (error.body ? error.body.message : error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleDownloadAnalytics() {
        try {
            if (!this.filteredAnalytics || this.filteredAnalytics.length === 0) {
                this.showToast('Info', 'No analytics data to export', 'info');
                return;
            }

            // Clone data to avoid Proxy issues
            const dataToExport = JSON.parse(JSON.stringify(this.filteredAnalytics));
            
            // Define Headers
            const headers = ['Name', 'Total Leaves (YTD)', 'WFH Taken', 'LoP Days', 'Sick Bal', 'Casual Bal'];
            let csv = headers.join(',') + '\n';
            
            dataToExport.forEach(row => {
                const name = row.Name ? row.Name.replace(/,/g, ' ') : '';
                const total = row.TotalTaken || 0;
                const wfh = row.WFHDays || 0;
                const lop = row.LOPDays || 0;
                const sick = row.SickBal || 0;
                const casual = row.CasualBal || 0;
                
                csv += `"${name}","${total}","${wfh}","${lop}","${sick}","${casual}"\n`;
            });

            // Add BOM
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/plain' });
            const link = document.createElement("a");
            
            const filename = `Team_Analytics.csv`;

            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, filename);
            } else {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            console.error('Export Error:', e);
            this.showToast('Error', 'Failed to download analytics: ' + e.message, 'error');
        }
    }
    
    // --- EMPLOYEE TAB METHODS ---
    wiredAllEmployeesResult;
    
    @wire(getAllEmployees, { callerId: '$hrIdParam' })
    wiredAllEmployees(result) {
        this.wiredAllEmployeesResult = result;
        if (result.data) {
            this.allEmployees = result.data.map(emp => {
                let empName = emp.Name;
                let init = empName ? empName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'U';
                return {
                    ...emp,
                    profilePicUrl: emp.Profile_Picture_URL__c,
                    initials: init,
                    StatusBadge: emp.Is_Active__c ? 'Active' : 'Inactive',
                    StatusBadgeColor: emp.Is_Active__c ? 'slds-text-color_success' : 'slds-text-color_error',
                    ReportsToName: emp.ReportsTo ? emp.ReportsTo.Name : 'N/A'
                };
            });
        }
    }
    
    refreshEmployees() {
        if(this.wiredAllEmployeesResult) refreshApex(this.wiredAllEmployeesResult).catch(err => console.error('Error refreshing employees:', err));
    }
    
    handleEmployeeRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'view_details') {
            this.selectedEmployeeDetail = { ...row, isProbation: row.Employee_Type__c === 'Probation' };
            this.isEmployeeDetailModalOpen = true;
        }
    }
    
    handleEmployeeRowActionBtn(event) {
        const rowId = event.target.value;
        const row = this.allEmployees.find(emp => emp.Id === rowId);
        if (row) {
            this.selectedEmployeeDetail = { ...row, isProbation: row.Employee_Type__c === 'Probation' };
            this.selectedPositions = row.Position__c ? row.Position__c.split(';') : [];
            this.isEmployeeDetailModalOpen = true;
        }
    }

    handlePositionChange(event) {
        this.selectedPositions = event.detail.value;
    }

    handleTsaChange(event) {
        this.selectedEmployeeDetail = { ...this.selectedEmployeeDetail, Is_Technical_System_Admin__c: event.target.checked };
    }

    async handleUpdatePosition() {
        this.isEmployeeUpdating = true;
        try {
            const newPositions = this.selectedPositions.join(';');
            await updateEmployeePosition({ 
                contactId: this.selectedEmployeeDetail.Id, 
                newPositions: newPositions,
                isTechnicalSystemAdmin: this.selectedEmployeeDetail.Is_Technical_System_Admin__c,
                callerId: this.currentUser.contactId
            });
            
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Roles and Positions updated successfully.',
                variant: 'success'
            }));
            
            // Refresh employee data
            await refreshApex(this.wiredAllEmployeesResult);
            this.closeEmployeeDetailModal();
            
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        } finally {
            this.isEmployeeUpdating = false;
        }
    }
    
    handleImageError(event) {
        const empId = event.target.dataset.id;
        
        // Check All Employees
        let foundInAll = this.allEmployees.findIndex(emp => emp.Id === empId);
        if (foundInAll !== -1) {
            this.allEmployees[foundInAll].profilePicUrl = null;
            this.allEmployees = [...this.allEmployees];
        }
        
        // Check Pending Leaves
        let foundInPending = this.pendingLeaves.findIndex(l => l.Employee__c === empId || l.Id === empId);
        if (foundInPending !== -1) {
            this.pendingLeaves[foundInPending].profilePicUrl = null;
            this.pendingLeaves = [...this.pendingLeaves];
        }
        
        // Check Modal
        if (this.selectedEmployeeDetail && this.selectedEmployeeDetail.Id === empId) {
            this.selectedEmployeeDetail = { ...this.selectedEmployeeDetail, Profile_Picture_URL__c: null };
        }
    }
    
    closeEmployeeDetailModal() {
        this.isEmployeeDetailModalOpen = false;
        this.selectedEmployeeDetail = {};
    }
    
    async handleToggleEmployeeStatus() {
        this.isEmployeeUpdating = true;
        const newStatus = !this.selectedEmployeeDetail.Is_Active__c;
        const actionStr = newStatus ? 'Activate' : 'Deactivate';
        
        const confirm = await LightningConfirm.open({
            message: `Are you sure you want to ${actionStr} this employee's login access?`,
            variant: 'headerless'
        });
        
        if(confirm) {
            try {
                await toggleEmployeeStatus({ contactId: this.selectedEmployeeDetail.Id, isActive: newStatus, callerId: this.currentUser.contactId });
                this.showToast('Success', `Employee account ${newStatus ? 'activated' : 'deactivated'}.`, 'success');
                this.selectedEmployeeDetail = {
                    ...this.selectedEmployeeDetail, 
                    Is_Active__c: newStatus,
                    StatusBadge: newStatus ? 'Active' : 'Inactive',
                    StatusBadgeColor: newStatus ? 'slds-text-color_success' : 'slds-text-color_error'
                };
                this.refreshEmployees();
            } catch(e) {
                this.showToast('Error', e.body ? e.body.message : e.message, 'error');
            }
        }
        this.isEmployeeUpdating = false;
    }

    async handleMakePermanent() {
        this.isEmployeeUpdating = true;
        const confirm = await LightningConfirm.open({
            message: `Are you sure you want to make this employee Permanent?`,
            variant: 'headerless'
        });
        
        if (confirm) {
            try {
                await makeEmployeePermanent({ contactId: this.selectedEmployeeDetail.Id, callerId: this.currentUser.contactId });
                this.showToast('Success', 'Employee is now Permanent.', 'success');
                this.selectedEmployeeDetail = {
                    ...this.selectedEmployeeDetail,
                    Employee_Type__c: 'Permanent',
                    isProbation: false
                };
                this.refreshEmployees();
            } catch(e) {
                this.showToast('Error', e.body ? e.body.message : e.message, 'error');
            }
        }
        this.isEmployeeUpdating = false;
    }

    // --- MARK LEAVE BY HR ---MARK LEAVE HANDLERS ---
    
    // Searchable Logic
    @track selectedEmployeeName;
    @track isSearchExpanded = false;
    @track filteredEmployeeOptions = [];

    get searchDropdownClass() {
        return 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ' + (this.isSearchExpanded ? 'slds-is-open' : '');
    }

    handleEmployeeSearch(event) {
        const searchKey = event.target.value.toLowerCase();
        this.selectedEmployeeName = event.target.value;
        this.filterEmployees(searchKey);
        this.isSearchExpanded = true;
    }

    handleEmployeeSearchFocus() {
        this.filterEmployees(this.selectedEmployeeName || '');
        this.isSearchExpanded = true;
    }

    handleEmployeeSearchBlur() {
        // Delayed close to allow mousedown to fire
        setTimeout(() => {
            this.isSearchExpanded = false;
        }, 200);
    }

    filterEmployees(key) {
        if (!key) {
            this.filteredEmployeeOptions = this.employeeOptions;
        } else {
            this.filteredEmployeeOptions = this.employeeOptions.filter(opt => 
                opt.label.toLowerCase().includes(key.toLowerCase())
            );
        }
    }

    handleEmployeeSelectOption(event) {
        // Prevent default to ensure blur doesn't kill it before we act (though onmousedown usually beats blur)
        const val = event.currentTarget.dataset.value;
        const lbl = event.currentTarget.dataset.label;
        
        this.selectedEmployeeId = val;
        this.selectedEmployeeName = lbl;
        this.isSearchExpanded = false;
    }

    // Leave Type Dropdown Logic
    @track selectedLeaveTypeName;
    @track isLeaveTypeExpanded = false;

    get leaveTypeDropdownClass() {
        return 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ' + (this.isLeaveTypeExpanded ? 'slds-is-open' : '');
    }

    handleLeaveTypeClick() {
        this.isLeaveTypeExpanded = !this.isLeaveTypeExpanded;
    }

    handleLeaveTypeBlur() {
        setTimeout(() => {
            this.isLeaveTypeExpanded = false;
        }, 200);
    }

    handleLeaveTypeSelectOption(event) {
        const val = event.currentTarget.dataset.value;
        const lbl = event.currentTarget.dataset.label;
        
        this.selectedLeaveTypeId = val;
        this.selectedLeaveTypeName = lbl;
        this.isLeaveTypeExpanded = false;
    }
    
    handleMarkDateChange(event) { 
        if (event.target.name === 'from') this.markFromDate = event.detail.value;
        if (event.target.name === 'to') this.markToDate = event.detail.value;
    }
    handleMarkReasonChange(event) { this.markReason = event.detail.value; }
    handleHalfDayChange(event) { 
        this.isHalfDay = event.target.checked; 
        if (this.isHalfDay && this.markFromDate) {
            this.markToDate = this.markFromDate;
        }
    }

    handleSessionChange(event) {
        this.halfDaySession = event.detail.value;
    }

    get isMarkLeaveDisabled() {
        return !this.selectedEmployeeId || !this.selectedLeaveTypeId || !this.markFromDate || !this.markToDate;
    }

    handleMarkLeaveSubmit() {
        this.isLoading = true;
        createLeaveByHR({
            employeeId: this.selectedEmployeeId,
            fromDate: this.markFromDate,
            toDate: this.markToDate,
            leaveType: '', // Unused in Apex if using ID
            reason: this.markReason,
            leaveTypeId: this.selectedLeaveTypeId,
            isHalfDay: this.isHalfDay, // Pass Half Day flag
            markedByName: this.userName, // 'HR Admin' or actual name
            halfDaySession: this.isHalfDay ? this.halfDaySession : '',
            callerId: this.currentUser.contactId
        })
        .then(async () => { // Async for alert
            await LightningAlert.open({
                message: 'Leave Marked Successfully',
                theme: 'success',
                label: 'Success',
            });
            // Reset Form
            this.selectedEmployeeId = null;
            this.selectedEmployeeName = ''; // Reset Input
            this.selectedLeaveTypeId = null;
            this.selectedLeaveTypeName = ''; // Reset Leave Type Input
            this.markFromDate = null;
            this.markToDate = null;
            this.markReason = '';
            this.isHalfDay = false; // Reset checkbox
            this.halfDaySession = 'FN';
            
            this.refreshData();
        })
        .catch(async error => {
            console.error('Mark Leave Error:', error);
            let msg = 'Unknown Error';
            // Robust Error Extraction
            if (error.body) {
                if (error.body.message) msg = error.body.message;
                else if (error.body.pageErrors && error.body.pageErrors.length > 0) msg = error.body.pageErrors[0].message;
            } else if (error.message) {
                msg = error.message;
            }

            await LightningAlert.open({
                message: msg,
                theme: 'error',
                label: 'Error Marking Leave',
            });
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    // --- PROFILE ---
    fetchProfile() {
        if (this.currentUser && this.currentUser.contactId) {
            getContactDetails({ contactId: this.currentUser.contactId }).then(r => { 
                if(r.success) {
                    this.userName = r.employeeName;
                    this.profileData = r;
                }
            });
        }
    }
    
    openProfile() { this.isProfileOpen = true; setTimeout(() => this.template.querySelector('c-user-profile-modal').open(), 0); }
    closeProfile() { this.isProfileOpen = false; }
    handleProfileUpdate(event) { 
        sessionStorage.setItem('paybookUser', JSON.stringify({ ...this.currentUser, ...event.detail }));
        this.userName = event.detail.firstName; 
    }

    refreshData() {
        refreshApex(this.wiredPendingResult);
        refreshApex(this.wiredStatsResult);
        refreshApex(this.wiredTeamStatusResult);
        refreshApex(this.wiredAnalyticsResult);
        this.fetchReportData();
    }

    // --- POPUP MODAL HANDLERS ---
    handleApprovedCardClick() {
        // Fetch approved leaves for this month
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        getLeavesByDateRangeAndStatus({ 
            startDate: firstDay.toISOString().split('T')[0], 
            endDate: lastDay.toISOString().split('T')[0],
            statuses: ['HR_Approved', 'Approved'],
            callerId: this.currentUser.contactId
        })
        .then(data => {
            this.approvedLeavesList = data
                .map(leave => ({
                    ...leave,
                    employeeName: leave.Employee__r ? leave.Employee__r.Name : '',
                    leaveType: leave.Leave_Type__r ? leave.Leave_Type__r.Name : ''
                }));
            this.isApprovedModalOpen = true;
        })
        .catch(error => {
            this.showToast('Error', 'Failed to fetch approved leaves', 'error');
        });
    }

    handleCancelledCardClick() {
        // Fetch cancelled leaves for this month
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        getLeavesByDateRangeAndStatus({ 
            startDate: firstDay.toISOString().split('T')[0], 
            endDate: lastDay.toISOString().split('T')[0],
            statuses: ['Cancelled'],
            callerId: this.currentUser.contactId
        })
        .then(data => {
            this.cancelledLeavesList = data
                .map(leave => ({
                    ...leave,
                    employeeName: leave.Employee__r ? leave.Employee__r.Name : '',
                    leaveType: leave.Leave_Type__r ? leave.Leave_Type__r.Name : ''
                }));
            this.isCancelledModalOpen = true;
        })
        .catch(error => {
            this.showToast('Error', 'Failed to fetch cancelled leaves', 'error');
        });
    }

    handleRejectedCardClick() {
        this.isLoading = true; // Show spinner immediately
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        getLeavesByDateRangeAndStatus({ 
            startDate: firstDay.toISOString().split('T')[0], 
            endDate: lastDay.toISOString().split('T')[0],
            statuses: ['HR_Rejected', 'Manager_Rejected', 'Rejected'],
            callerId: this.currentUser.contactId
        })
        .then(data => {
            this.rejectedLeavesList = data
                .map(leave => ({
                    ...leave,
                    employeeName: leave.Employee__r ? leave.Employee__r.Name : '',
                    leaveType: leave.Leave_Type__r ? leave.Leave_Type__r.Name : ''
                }));
            this.isRejectedModalOpen = true;
        })
        .catch(error => {
            console.error('Error fetching rejected leaves', error);
            this.showToast('Error', 'Failed to fetch rejected leaves', 'error');
        })
        .finally(() => {
            this.isLoading = false; // Hide spinner
        });
    }

    closeApprovedModal() {
        this.isApprovedModalOpen = false;
    }

    closeRejectedModal() {
        this.isRejectedModalOpen = false;
    }

    closeCancelledModal() {
        this.isCancelledModalOpen = false;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // --- HARDWARE REPORT LOGIC ---

    get hwTypeOptionsFilter() {
        return [
            { label: 'All Types', value: 'All' },
            ...this.typeOptions
        ];
    }

    get hwStatusOptionsFilter() {
        return [
            { label: 'All Statuses', value: 'All' },
            ...this.statusOptions
        ];
    }

    get hwViewModeAllVariant() {
        return this.hardwareViewMode === 'all' ? 'brand' : 'neutral';
    }

    get hwViewModeUserVariant() {
        return this.hardwareViewMode === 'user' ? 'brand' : 'neutral';
    }

    get isHwViewModeAll() {
        return this.hardwareViewMode === 'all';
    }

    loadHardwareReport() {
        this.hardwareLoading = true;
        getHardwareInventory({ callerId: this.currentUser.contactId })
            .then(data => {
                this.hardwareData = data.map(hw => {
                    let badgeClass = 'slds-badge ';
                    if (hw.Status__c === 'Available') badgeClass += 'slds-theme_success';
                    else if (hw.Status__c === 'Assigned') badgeClass += 'slds-theme_info';
                    else if (hw.Status__c === 'Under Maintenance') badgeClass += 'slds-theme_warning';
                    else if (hw.Status__c === 'Retired') badgeClass += 'slds-theme_error';
                    
                    return {
                        ...hw,
                        AssignedToName: hw.Assigned_To__r ? hw.Assigned_To__r.Name : '-',
                        statusBadgeClass: badgeClass
                    };
                });
                this.filterHardwareReport();
            })
            .catch(error => {
                console.error('Error loading hardware inventory:', error);
                this.showToast('Error', 'Failed to fetch hardware inventory: ' + (error.body ? error.body.message : error.message), 'error');
            })
            .finally(() => {
                this.hardwareLoading = false;
            });
    }

    handleHwSearch(event) {
        this.hardwareSearchKey = event.target.value;
        this.filterHardwareReport();
    }

    handleHwTypeChange(event) {
        this.selectedHwType = event.detail.value;
        this.filterHardwareReport();
    }

    handleHwStatusChange(event) {
        this.selectedHwStatus = event.detail.value;
        this.filterHardwareReport();
    }

    setHwViewModeAll() {
        this.hardwareViewMode = 'all';
    }

    setHwViewModeUser() {
        this.hardwareViewMode = 'user';
    }

    filterHardwareReport() {
        const lowerKey = this.hardwareSearchKey.toLowerCase();
        
        // 1. Filter All Hardware
        this.filteredHardware = this.hardwareData.filter(hw => {
            const matchesSearch = !lowerKey || 
                (hw.Name && hw.Name.toLowerCase().includes(lowerKey)) || 
                (hw.Serial_Number__c && hw.Serial_Number__c.toLowerCase().includes(lowerKey)) ||
                (hw.AssignedToName && hw.AssignedToName.toLowerCase().includes(lowerKey));
                
            const matchesType = this.selectedHwType === 'All' || hw.Type__c === this.selectedHwType;
            const matchesStatus = this.selectedHwStatus === 'All' || hw.Status__c === this.selectedHwStatus;
            
            return matchesSearch && matchesType && matchesStatus;
        });

        // 2. Regroup filtered hardware for User Wise view
        this.filteredUserWise = this.groupUserWiseHardware(this.filteredHardware);
    }

    groupUserWiseHardware(hwList) {
        const userMap = {};
        hwList.forEach(hw => {
            if (hw.Assigned_To__c) {
                const userId = hw.Assigned_To__c;
                const userName = hw.Assigned_To__r ? hw.Assigned_To__r.Name : 'Unknown';
                if (!userMap[userId]) {
                    userMap[userId] = {
                        userId: userId,
                        userName: userName,
                        hardwareList: []
                    };
                }
                userMap[userId].hardwareList.push(hw);
            }
        });
        return Object.values(userMap);
    }

    handleDownloadHardware() {
        try {
            if (!this.filteredHardware || this.filteredHardware.length === 0) {
                this.showToast('Info', 'No hardware data to export', 'info');
                return;
            }

            const headers = ['Hardware Name', 'Type', 'Serial Number', 'Status', 'Location', 'Assigned To', 'Date Assigned'];
            let csv = headers.join(',') + '\n';
            
            this.filteredHardware.forEach(row => {
                const name = row.Name ? row.Name.replace(/,/g, ' ') : '';
                const type = row.Type__c || '';
                const serial = row.Serial_Number__c || '';
                const status = row.Status__c || '';
                const location = row.Location__c || '';
                const assignedTo = row.AssignedToName || '';
                const dateAssigned = row.Date_Assigned__c || '';
                
                csv += `"${name}","${type}","${serial}","${status}","${location}","${assignedTo}","${dateAssigned}"\n`;
            });

            const blob = new Blob(['\uFEFF' + csv], { type: 'text/plain' });
            const link = document.createElement("a");
            const filename = `Hardware_Report.csv`;

            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, filename);
            } else {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            console.error('Export Error:', e);
            this.showToast('Error', 'Failed to download report: ' + e.message, 'error');
        }
    }

    // --- HR NEW HARDWARE REQUEST MODAL METHODS ---
    openHRHwRequestModal() {
        this.hrHardwareSelectedEmployee = undefined;
        this.hrHardwareSelectedType = undefined;
        this.hrHardwareSelectedDescription = '';
        this.isHRHardwareRequestModalOpen = true;
    }

    closeHRHwRequestModal() {
        this.isHRHardwareRequestModalOpen = false;
    }

    handleHRHwEmployeeChange(event) {
        this.hrHardwareSelectedEmployee = event.detail.value;
    }

    handleHRHwTypeChange(event) {
        this.hrHardwareSelectedType = event.detail.value;
    }

    handleHRHwDescriptionChange(event) {
        this.hrHardwareSelectedDescription = event.target.value;
    }

    get isHRHwSubmitDisabled() {
        return !this.hrHardwareSelectedEmployee || !this.hrHardwareSelectedType || !this.hrHardwareSelectedDescription;
    }

    async submitHRHwRequest() {
        this.isLoading = true;
        try {
            await createHardwareRequest({
                contactId: this.hrHardwareSelectedEmployee,
                hardwareType: this.hrHardwareSelectedType,
                description: this.hrHardwareSelectedDescription
            });
            this.showToast('Success', 'Hardware request submitted successfully.', 'success');
            this.closeHRHwRequestModal();
            this.loadEscalatedRequests(); // Refresh hardware list
        } catch (error) {
            console.error('Error submitting hardware request:', error);
            this.showToast('Error', 'Failed to submit hardware request: ' + (error.body ? error.body.message : error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }
}