import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExchangeController } from '../src/exchange/controllers/exchange.controller';
import { ExchangeAuthService } from '../src/exchange/services/exchange-auth.service';
import { MailService } from '../src/exchange/services/mail.service';
import { ExchangeAuthGuard } from '../src/auth/guards/exchange-auth.guard';

describe('Webmail list/read pagination (e2e)', () => {
  let app: INestApplication<App>;

  const authServiceMock = {
    login: jest.fn(),
    rotateRefreshToken: jest.fn(),
    logout: jest.fn(),
    validateSession: jest.fn().mockResolvedValue(true),
    refreshSession: jest.fn().mockResolvedValue(true),
  };

  const inboxMessages = Array.from({ length: 5 }, (_, index) => {
    const seq = index + 1;
    const id = Buffer.from(`INBOX:${seq}`).toString('base64');
    return {
      id,
      subject: `Mail ${seq}`,
      from: { name: 'Sender', email: `sender${seq}@mailex.local` },
      receivedAt: new Date(`2026-02-2${seq}T00:00:00.000Z`),
      isRead: false,
      hasAttachments: false,
      preview: `Preview ${seq}`,
    };
  });

  const mailServiceMock = {
    getFolders: jest.fn(),
    getFolderCounts: jest.fn(),
    getMessages: jest.fn(),
    getMessage: jest.fn(),
    sendMessage: jest.fn(),
    searchMessages: jest.fn(),
    moveMessage: jest.fn(),
    markAsRead: jest.fn(),
    moveMessagesBatch: jest.fn(),
    permanentDelete: jest.fn(),
    markStar: jest.fn(),
    unmarkStar: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [
        { provide: ExchangeAuthService, useValue: authServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: ExchangeAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        stopAtFirstError: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mailServiceMock.getMessages.mockImplementation(
      async (_folder: string, page: number, pageSize: number) => {
        const start = (page - 1) * pageSize;
        const items = inboxMessages.slice(start, start + pageSize);
        return {
          items,
          total: inboxMessages.length,
        };
      },
    );

    mailServiceMock.getMessage.mockImplementation(async (id: string) => {
      const found = inboxMessages.find((message) => message.id === id);
      if (!found) {
        throw new NotFoundException('Message not found');
      }

      return {
        ...found,
        to: [{ name: 'Receiver', email: 'test.user1@mailex.local' }],
        cc: [],
        body: `<p>${found.subject}</p>`,
        isHtml: true,
      };
    });
  });

  it('lists first page with pageSize=2 and keeps total count', async () => {
    const response = await request(app.getHttpServer())
      .get('/webmail/mail?folder=inbox&page=1&pageSize=2')
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.total).toBe(5);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].subject).toBe('Mail 1');
    expect(response.body.items[1].subject).toBe('Mail 2');
    expect(mailServiceMock.getMessages).toHaveBeenCalledWith('inbox', 1, 2);
  });

  it('lists third page with pageSize=2 and returns only remaining item', async () => {
    const response = await request(app.getHttpServer())
      .get('/webmail/mail?folder=inbox&page=3&pageSize=2')
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.total).toBe(5);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].subject).toBe('Mail 5');
  });

  it('returns empty items when page is out of range', async () => {
    const response = await request(app.getHttpServer())
      .get('/webmail/mail?folder=inbox&page=4&pageSize=2')
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.total).toBe(5);
    expect(response.body.items).toEqual([]);
  });

  it('reads a mail detail by id', async () => {
    const targetId = inboxMessages[0].id;

    const response = await request(app.getHttpServer())
      .get(`/webmail/mail/${targetId}`)
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.id).toBe(targetId);
    expect(response.body.subject).toBe('Mail 1');
    expect(response.body.body).toContain('Mail 1');
    expect(mailServiceMock.getMessage).toHaveBeenCalledWith(targetId);
  });

  it('returns 404 when reading a non-existing mail id', async () => {
    await request(app.getHttpServer())
      .get(`/webmail/mail/${Buffer.from('INBOX:9999').toString('base64')}`)
      .set('Cookie', ['exchange_session=access-token'])
      .expect(404);
  });
});
