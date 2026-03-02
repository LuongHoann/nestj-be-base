export interface ExchangeContact {
  id: string;
  displayName: string;
  email: string;
  givenName?: string;
  surname?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  address?: ExchangeContactAddress;
}

export interface ExchangeContactAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ExchangeNote {
  id: string;
  subject?: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExchangeSearchResult<T> {
  items: T[];
  total: number;
}
