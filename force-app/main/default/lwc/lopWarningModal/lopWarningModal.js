import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export default class LopWarningModal extends LightningModal {
    handleOk() {
        this.close('ok');
    }

    handleCancel() {
        this.close('cancel'); 
    }
}