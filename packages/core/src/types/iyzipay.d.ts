declare module 'iyzipay' {
  interface IyzipayOptions {
    apiKey: string;
    secretKey: string;
    uri?: string;
  }
  interface IyzipayResult {
    status: 'success' | 'failure';
    errorCode?: string;
    errorMessage?: string;
    token?: string;
    paymentPageUrl?: string;
    threeDSHtmlContent?: string;
    paymentId?: string;
    conversationId?: string;
    rawResult?: unknown;
  }
  interface PaymentPageInitializeRequest {
    locale?: string;
    conversationId?: string;
    price: string;
    paidPrice: string;
    currency?: string;
    basketId?: string;
    paymentGroup?: string;
    callbackUrl: string;
    enabledInstallments?: number[];
    buyer: Record<string, unknown>;
    shippingAddress: Record<string, unknown>;
    billingAddress: Record<string, unknown>;
    basketItems: Record<string, unknown>[];
  }
  class Iyzipay {
    constructor(options: IyzipayOptions);
    paymentPage: {
      initialize(
        request: PaymentPageInitializeRequest,
        callback: (err: unknown, result: IyzipayResult) => void
      ): void;
    };
    payment: {
      retrieve(
        request: { locale?: string; conversationId?: string; paymentId?: string; paymentConversationId?: string },
        callback: (err: unknown, result: IyzipayResult) => void
      ): void;
    };
    refund: {
      create(
        request: Record<string, unknown>,
        callback: (err: unknown, result: IyzipayResult) => void
      ): void;
    };
  }
  export default Iyzipay;
}
