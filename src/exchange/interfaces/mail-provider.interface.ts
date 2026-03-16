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
  bcc: { name: string; email: string }[];
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
  id: string; // e.g., 'INBOX', 'Sent Items', 'Starred', 'Drafts', 'Spam', 'Trash' hoặc FolderId từ EWS
  name: string;
  type?: string; // e.g., 'inbox', 'sent', 'user_created'
  parentId?: string;
  children?: MailFolder[];
  isSystem: boolean;
  unreadCount?: number;
  totalCount?: number;
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

export interface ReplyMailOptions {
  messageId: string;
  html?: string;
  text?: string;
  replyAll?: boolean;
  attachments?: Attachment[];
}

export interface ForwardMailOptions {
  messageId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  html?: string;
  text?: string;
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
    mailbox?: string,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
   * Get unread/total counts for standard folders
   */
  getFolderCounts(mailbox?: string): Promise<Record<string, { total: number; unread: number }>>;

  /**
   * Get a single message by its composite ID
   */
  getMessage(id: string): Promise<MailMessage>;

  downloadAttachment(messageId: string, index: number): Promise<{ filename: string; contentType: string; content: Buffer }>;

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
    folder?: string,
    mailbox?: string,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
   * Move message to another folder
   */
  moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }>;

  markMessages(ids: string[], isRead: boolean): Promise<void>;
  markAllMessages(folder: string, isRead: boolean, mailbox?: string): Promise<void>;
  moveMessagesBatch(ids: string[], targetFolder: string): Promise<void>;
  moveAllMessages(
    sourceFolder: string,
    targetFolder: string,
    mailbox?: string,
  ): Promise<void>;
  permanentlyDeleteMessages(ids: string[]): Promise<number>;
  permanentlyDeleteAllMessages(folder: string, mailbox?: string): Promise<number>;
  markMessagesStar(ids: string[], starred: boolean): Promise<void>;
  markAllMessagesStar(folder: string, starred: boolean, mailbox?: string): Promise<void>;

  replyMessage(options: ReplyMailOptions): Promise<{ success: boolean; messageId?: string }>;
  forwardMessage(options: ForwardMailOptions): Promise<{ success: boolean; messageId?: string }>;
  getConversationMessages(messageId: string, maxItems: number): Promise<any>;

  // Calendar
  createEvent(payload: any): Promise<any>;
  getEvents(startDate: string, endDate: string): Promise<any[]>;
  getEventDetails(eventId: string): Promise<any>;
  updateEvent(eventId: string, payload: any): Promise<any>;
  deleteEvent(eventId: string): Promise<void>;
  getActiveReminders(): Promise<any[]>;
  dismissReminder(eventId: string): Promise<void>;
}
