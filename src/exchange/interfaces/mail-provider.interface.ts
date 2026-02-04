export interface MailMessage {
  id: string; // Composite ID: Base64(folder:uid)
  subject: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  receivedAt: Date;
  body: string;
  isHtml: boolean;
  hasAttachments: boolean;
  isRead: boolean;
  preview: string;
  importance?: string;
}

export interface MailFolder {
  id: string; // e.g., 'INBOX', 'Sent', 'Drafts'
  name: string;
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export interface IMailProvider {
  /**
    * Connect to the mail server
    */
  connect(): Promise<void>;

  /**
    * Disconnect from the mail server
    */
  disconnect(): Promise<void>;

  /**
    * Get list of standard folders
    */
  getFolders(): Promise<MailFolder[]>;

  /**
    * Get messages from a folder with pagination
    */
  getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
    * Get a single message by its composite ID
    */
  getMessage(id: string): Promise<MailMessage>;

  /**
    * Send an email
    */
  sendMessage(options: SendMailOptions): Promise<{ success: boolean; messageId?: string }>;

  /**
    * Search messages
    */
  search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;
}
