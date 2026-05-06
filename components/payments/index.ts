/**
 * @module    components/payments
 *
 * Payment widgets: standalone provider components plus a compound
 * `PaymentGateway` that orchestrates them in a single checkout UI.
 */

export { PaymentGateway } from './PaymentGateway.ts';
export type {
    PaymentGatewayOptions, PaymentGatewayMethodConfig, PaymentMethodId,
} from './PaymentGateway.ts';

export { CreditCard, detectBrand, validateLuhn, formatCardNumber } from './CreditCard.ts';
export type { CreditCardOptions, CardData, CardBrand } from './CreditCard.ts';

export { ApplePay }  from './ApplePay.ts';
export type { ApplePayOptions, ApplePayNetwork, ApplePayMerchantCapability } from './ApplePay.ts';

export { GooglePay } from './GooglePay.ts';
export type { GooglePayOptions, GPayCardNetwork, GPayAuthMethod } from './GooglePay.ts';

export { PayPal }    from './PayPal.ts';
export type { PayPalOptions } from './PayPal.ts';

export { Stripe }    from './Stripe.ts';
export type { StripeOptions } from './Stripe.ts';

export { AliPay }    from './AliPay.ts';
export type { AliPayOptions } from './AliPay.ts';

export { Satispay }  from './Satispay.ts';
export type { SatispayOptions } from './Satispay.ts';

export { Nexi }      from './Nexi.ts';
export type { NexiOptions } from './Nexi.ts';
