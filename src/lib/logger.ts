export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
    message: string;
    error?: any;
    userId?: string;
    action?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
}

class CentralLogger {
    private formatMessage(level: LogLevel, context: LogContext) {
        const timestamp = new Date().toISOString();
        const { message, error, userId, action, metadata, ...rest } = context;

        // In a real production environment (like Datadog/Sentry), 
        // you would stream this structured JSON object directly to the ingester.
        const logPayload = {
            timestamp,
            level: level.toUpperCase(),
            message,
            userId: userId || 'SYSTEM',
            action: action || 'UNKNOWN_ACTION',
            errorDetail: error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            metadata,
            ...rest
        };

        return JSON.stringify(logPayload);
    }

    info(context: LogContext) {
        console.log(this.formatMessage('info', context));
    }

    warn(context: LogContext) {
        console.warn(this.formatMessage('warn', context));
    }

    error(context: LogContext) {
        console.error(this.formatMessage('error', context));
    }

    debug(context: LogContext) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(this.formatMessage('debug', context));
        }
    }
}

export const logger = new CentralLogger();
