import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExchangeController } from '../src/exchange/controllers/exchange.controller';
import { ExchangeAuthService } from '../src/exchange/services/exchange-auth.service';
import { MailService } from '../src/exchange/services/mail.service';
import { ExchangeAuthGuard } from '../src/auth/guards/exchange-auth.guard';

describe('Webmail send/receive (e2e)', () => {
  let app: INestApplication<App>;

  const authServiceMock = {
    login: jest.fn().mockResolvedValue({
      email: 'test.user1@mailex.local',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    rotateRefreshToken: jest.fn(),
    logout: jest.fn(),
    validateSession: jest.fn().mockResolvedValue(true),
    refreshSession: jest.fn().mockResolvedValue(true),
  };

  const messageId = Buffer.from('INBOX:123').toString('base64');

  const mailServiceMock = {
    getFolders: jest.fn(),
    getFolderCounts: jest.fn(),
    getMessages: jest.fn().mockResolvedValue({
      items: [
        {
          id: messageId,
          subject: 'Hello',
          from: { name: 'User 2', email: 'test.user2@mailex.local' },
          receivedAt: new Date('2026-02-26T00:00:00.000Z'),
          isRead: false,
          hasAttachments: false,
          preview: 'Hello there',
        },
      ],
      total: 1,
    }),
    getMessage: jest.fn().mockResolvedValue({
      id: messageId,
      subject: 'Hello',
      from: { name: 'User 2', email: 'test.user2@mailex.local' },
      to: [{ name: 'User 1', email: 'test.user1@mailex.local' }],
      cc: [],
      receivedAt: new Date('2026-02-26T00:00:00.000Z'),
      body: '<p>Hello there</p>',
      isHtml: true,
      hasAttachments: false,
      isRead: true,
      preview: 'Hello there',
    }),
    sendMessage: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'smtp-msg-1',
    }),
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
  });

  it('POST /webmail/mail/send sends an email', async () => {
    const payload = {
      to: ['test.user2@mailex.local'],
      subject: 'Smoke send',
      text: 'Hello',
    };

    const response = await request(app.getHttpServer())
      .post('/webmail/mail/send')
      .set('Cookie', ['exchange_session=access-token'])
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({ success: true, messageId: 'smtp-msg-1' });
    expect(mailServiceMock.sendMessage).toHaveBeenCalledWith(payload);
  });

  it('GET /webmail/mail lists inbox messages (receive)', async () => {
    const response = await request(app.getHttpServer())
      .get('/webmail/mail?folder=inbox&page=1&pageSize=20')
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(messageId);
    expect(mailServiceMock.getMessages).toHaveBeenCalledWith('inbox', 1, 20);
  });

  it('GET /webmail/mail/:id reads message detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`/webmail/mail/${messageId}`)
      .set('Cookie', ['exchange_session=access-token'])
      .expect(200);

    expect(response.body.id).toBe(messageId);
    expect(response.body.subject).toBe('Hello');
    expect(mailServiceMock.getMessage).toHaveBeenCalledWith(messageId);
  });

  it('POST /webmail/mail/send validates required fields', async () => {
    await request(app.getHttpServer())
      .post('/webmail/mail/send')
      .set('Cookie', ['exchange_session=access-token'])
      .send({ subject: 'Missing to' })
      .expect(400);
  });
});
