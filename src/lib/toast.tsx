import { toast as sonnerToast } from 'sonner';
import { handleApiError } from './error-handler';

export const toast = Object.assign(
    (message: string | React.ReactNode, data?: any) => sonnerToast(message, data),
    sonnerToast,
    {
        error: (message: string | any, data?: any) => {
            const errorMsg = data?.description ? data.description : (typeof message === 'string' ? message : message?.message || 'Unknown Error');
            const title = typeof message === 'string' ? message : 'System Error';
            handleApiError(errorMsg, title, data?.id);
        }
    }
);
