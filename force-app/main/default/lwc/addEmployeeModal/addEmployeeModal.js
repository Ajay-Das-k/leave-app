import { LightningElement, api, track } from 'lwc';
import addEmployee from '@salesforce/apex/PaybookSignupController.addEmployee';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AddEmployeeModal extends LightningElement {
    @api isOpen = false;
    @api managerOptions = [];

    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track employeeId = '';
    @track employeeType = '';
    @track gender = '';
    @track department = '';
    @track mobile = '';
    @track birthdate = '';
    @track joiningDate = '';
    @track managerId = '';
    @track isManager = false;
    @track isHrAdmin = false;
    @track isTechnicalSystemAdmin = false;
    @track selectedPositions = [];

    @track isLoading = false;
    @track showError = false;
    @track errorMessage = '';
    @track showSuccess = false;
    @track successMessage = '';

    employeeTypeOptions = [
        { label: 'Permanent', value: 'Permanent' },
        { label: 'Probation', value: 'Probation' }
    ];

    genderOptions = [
        { label: 'Male', value: 'Male' },
        { label: 'Female', value: 'Female' },
        { label: 'Other', value: 'Other' }
    ];

    departmentOptions = [
        { label: 'Ad-Sales in a Box', value: 'Ad-Sales in a Box' },
        { label: 'TDS', value: 'TDS' },
        { label: 'AI', value: 'AI' }
    ];

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

    handleChange(event) {
        const field = event.target.name;
        this[field] = event.target.value;
    }

    handlePositionChange(event) {
        this.selectedPositions = event.detail.value;
    }

    handleCheckboxChange(event) {
        const field = event.target.name;
        this[field] = event.target.checked;
    }

    handleClose() {
        this.clearForm();
        this.dispatchEvent(new CustomEvent('close'));
    }

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

    async handleSubmit(event) {
        event.preventDefault();
        this.showError = false;
        this.showSuccess = false;
        this.isLoading = true;

        try {
            const result = await addEmployee({
                firstName: this.firstName,
                lastName: this.lastName,
                email: this.email,
                employeeId: this.employeeId.toUpperCase(),
                department: this.department,
                employeeType: this.employeeType,
                joiningDate: this.joiningDate,
                gender: this.gender,
                mobile: this.mobile,
                birthdate: this.birthdate,
                managerId: this.managerId,
                isManager: this.isManager,
                isHrAdmin: this.isHrAdmin,
                isTechnicalSystemAdmin: this.isTechnicalSystemAdmin,
                position: this.selectedPositions.join(';'),
                callerId: this.callerId
            });

            if (result.success) {
                this.showSuccess = true;
                this.successMessage = result.message;
                
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: result.message,
                    variant: 'success'
                }));

                // Dispatch success event for parent LWC to refresh lists
                this.dispatchEvent(new CustomEvent('success'));

                setTimeout(() => {
                    this.handleClose();
                }, 2000);
            } else {
                this.showError = true;
                this.errorMessage = result.message;
            }
        } catch (error) {
            this.showError = true;
            this.errorMessage = error.body ? error.body.message : error.message;
            console.error('Error adding employee:', error);
        } finally {
            this.isLoading = false;
        }
    }

    clearForm() {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.employeeId = '';
        this.employeeType = '';
        this.gender = '';
        this.department = '';
        this.mobile = '';
        this.birthdate = '';
        this.joiningDate = '';
        this.managerId = '';
        this.isManager = false;
        this.isHrAdmin = false;
        this.isTechnicalSystemAdmin = false;
        this.selectedPositions = [];
        this.showError = false;
        this.errorMessage = '';
        this.showSuccess = false;
        this.successMessage = '';
    }
}
