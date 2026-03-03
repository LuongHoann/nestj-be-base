export interface MailAttachmentMeta {
  index: number;
  filename: string;
  contentType?: string;
  size?: number;
}

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
  isStarred?: boolean;
  // Conversation group id
  conversationId?: string;
  attachments?: MailAttachmentMeta[];
}

export interface MailFolder {
  id: string; // e.g., 'INBOX', 'Sent Items', 'Starred', 'Drafts', 'Spam', 'Trash'
  name: string;
}

export interface Attachment {
  filename: string;
  contentType?: string;
  content: string; // Base64 encoded
}

export interface SendMailOptions {
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject?: string;
  text?: string; // Plain text version
  html?: string; // HTML version
  attachments?: Attachment[];
}

export interface SaveDraftOptions {
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
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
  sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }>;

  /**
   * Save a draft
   */
  saveDraft(
    options: SaveDraftOptions,
  ): Promise<{ success: boolean; messageId?: string }>;

  /**
   * Search messages
   */
  search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
   * Move message to another folder
   */
  moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }>;
}
