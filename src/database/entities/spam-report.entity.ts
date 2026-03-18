import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Entity lưu trữ thông tin báo cáo thư rác từ người dùng.
 * BẮT BUỘC: Dùng để Admin kiểm duyệt và quyết định chặn Global.
 */
@Entity({ tableName: 'spam_reports' })
export class SpamReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  reporterEmail: string;

  @Property()
  senderEmail: string;

  @Property()
  messageId: string;

  @Property()
  createdAt: Date = new Date();

  constructor(reporterEmail: string, senderEmail: string, messageId: string) {
    this.reporterEmail = reporterEmail;
    this.senderEmail = senderEmail;
    this.messageId = messageId;
  }
}
