import { ImapMailProvider } from '../src/exchange/services/imap-mail.provider';

describe('ImapMailProvider sent append', () => {
  function createProvider() {
    const configService = { get: jest.fn() } as any;
    const authService = { getCredentials: jest.fn() } as any;
    const smtpSenderService = { sendMail: jest.fn() } as any;
    const request = { cookies: {} } as any;

    const provider = new ImapMailProvider(
      configService,
      authService,
      smtpSenderService,
      request,
    );

    (provider as any).credentials = {
      email: 'test.user1@mailex.local',
      password: 'secret',
    };

    (provider as any).client = {
      append: jest.fn().mockResolvedValue({ uid: 123 }),
    };

    jest
      .spyOn(provider as any, 'resolveMailboxPath')
      .mockResolvedValue('Sent Items');

    return { provider, smtpSenderService };
  }

  it('appends to Sent Items after SMTP send success', async () => {
    const { provider, smtpSenderService } = createProvider();

    smtpSenderService.sendMail.mockResolvedValue({
      messageId: '<msg-1@mailex.local>',
    });

    const result = await provider.sendMessage({
      to: ['test.user2@mailex.local'],
      subject: 'Append test',
      text: 'hello',
    });

    expect(result).toEqual({ success: true, messageId: '<msg-1@mailex.local>' });
    expect((provider as any).client.append).toHaveBeenCalledTimes(1);
    expect((provider as any).client.append).toHaveBeenCalledWith(
      'Sent Items',
      expect.any(String),
      ['\\Seen'],
      expect.any(Date),
    );
  });

  it('does not append when SMTP response has no messageId', async () => {
    const { provider, smtpSenderService } = createProvider();

    smtpSenderService.sendMail.mockResolvedValue({});

    const result = await provider.sendMessage({
      to: ['test.user2@mailex.local'],
      subject: 'No message id',
      text: 'hello',
    });

    expect(result).toEqual({ success: false, messageId: undefined });
    expect((provider as any).client.append).not.toHaveBeenCalled();
  });
});
