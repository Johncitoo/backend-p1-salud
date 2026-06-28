import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type GoogleUserInfo = {
  id?: string;
  email?: string;
};

export type GoogleCalendarEventPayload = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

export type GoogleCalendarEventResponse = {
  id: string;
  etag?: string;
  htmlLink?: string;
};

@Injectable()
export class GoogleCalendarClientService {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(state: string): string {
    const clientId = this.requireConfig('GOOGLE_CALENDAR_CLIENT_ID');
    const redirectUri = this.requireConfig('GOOGLE_CALENDAR_REDIRECT_URI');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/calendar.events');
    url.searchParams.set('state', state);

    return url.toString();
  }

  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    return this.postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      code,
      client_id: this.requireConfig('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: this.requireConfig('GOOGLE_CALENDAR_CLIENT_SECRET'),
      redirect_uri: this.requireConfig('GOOGLE_CALENDAR_REDIRECT_URI'),
      grant_type: 'authorization_code',
    });
  }

  async refreshToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: this.requireConfig('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: this.requireConfig('GOOGLE_CALENDAR_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    });
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    return this.requestJson<GoogleUserInfo>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async createEvent(calendarId: string, accessToken: string, payload: GoogleCalendarEventPayload): Promise<GoogleCalendarEventResponse> {
    return this.requestJson<GoogleCalendarEventResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
  }

  async updateEvent(calendarId: string, eventId: string, accessToken: string, payload: GoogleCalendarEventPayload): Promise<GoogleCalendarEventResponse> {
    return this.requestJson<GoogleCalendarEventResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
  }

  async deleteEvent(calendarId: string, eventId: string, accessToken: string): Promise<void> {
    await this.requestJson<void>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      true,
    );
  }

  private async postForm<T>(url: string, values: Record<string, string>): Promise<T> {
    return this.requestJson<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values).toString(),
    });
  }

  private async requestJson<T>(url: string, init: RequestInit, allowEmpty = false): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();

    if (!response.ok) {
      throw new ServiceUnavailableException(`Google Calendar respondio ${response.status}: ${text.slice(0, 300)}`);
    }

    if (!text && allowEmpty) return undefined as T;
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  }

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value) throw new ServiceUnavailableException(`${name} no esta configurada.`);
    return value;
  }
}
