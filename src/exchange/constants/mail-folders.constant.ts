export type MailFolderType =
  | 'inbox'
  | 'sent'
  | 'starred'
  | 'drafts'
  | 'spam'
  | 'trash'
  | 'outbox';

export type MailFolderDefinition = {
  id: string;
  type: MailFolderType;
  name: string;
  aliases: string[];
};

export const MAIL_FOLDERS: MailFolderDefinition[] = [
  {
    id: 'INBOX',
    type: 'inbox',
    name: 'Hộp thư đến',
    aliases: ['INBOX'],
  },
  {
    id: 'Outbox',
    type: 'outbox',
    name: 'Thư chờ gửi',
    aliases: ['Outbox'],
  },
  {
    id: 'Sent Items',
    type: 'sent',
    name: 'Đã gửi',
    aliases: ['Sent Items', 'Sent'],
  },
  {
    id: 'Starred',
    type: 'starred',
    name: 'Có gắn dấu sao',
    aliases: ['Starred'],
  },
  {
    id: 'Drafts',
    type: 'drafts',
    name: 'Thư nháp',
    aliases: ['Drafts'],
  },
  {
    id: 'Spam',
    type: 'spam',
    name: 'Thư rác',
    aliases: ['Spam', 'Junk Email'],
  },
  {
    id: 'Trash',
    type: 'trash',
    name: 'Thùng rác',
    aliases: ['Trash', 'Deleted Items'],
  },
];

export const DEFAULT_FOLDER_ID = 'INBOX';

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function resolveFolderId(
  input: string,
  fallback = DEFAULT_FOLDER_ID,
): string {
  const normalized = normalize(input);

  for (const folder of MAIL_FOLDERS) {
    if (
      normalize(folder.id) === normalized ||
      normalize(folder.type) === normalized ||
      folder.aliases.some((alias) => normalize(alias) === normalized)
    ) {
      return folder.id;
    }
  }

  return input;
}

export function resolveFolderType(input: string): string {
  const normalized = normalize(input);

  for (const folder of MAIL_FOLDERS) {
    if (
      normalize(folder.id) === normalized ||
      normalize(folder.type) === normalized ||
      folder.aliases.some((alias) => normalize(alias) === normalized)
    ) {
      return folder.type;
    }
  }

  return normalized.replace(/\s+/g, '_');
}

export function getFolderAliases(input: string): string[] {
  const folderId = resolveFolderId(input, input);
  const folder = MAIL_FOLDERS.find((item) => item.id === folderId);
  if (!folder) return [input];
  return Array.from(new Set([folder.id, ...folder.aliases]));
}
