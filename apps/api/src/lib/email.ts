import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { Resend } from 'resend';

export interface Email {
    to: string;
    subject: string;
    text: string;
}

export type SendEmail = (email: Email) => void;

export function createEmailSender(config: Config, logger: Logger): SendEmail {
    const { from, resendApiKey } = config.email;

    if (!resendApiKey) {
        return ({ to, subject, text }) => {
            logger.info(
                `email to ${to} (not sent, no RESEND_API_KEY)\n${subject}\n\n${text}`
            );
        };
    }

    const resend = new Resend(resendApiKey);

    return ({ to, subject, text }) => {
        resend.emails
            .send({ from, to, subject, text })
            .then(({ error }) => {
                if (error) {
                    logger.error(
                        { err: error, subject },
                        'failed to send email'
                    );
                }
            })
            .catch((err: unknown) => {
                logger.error({ err, subject }, 'failed to send email');
            });
    };
}
