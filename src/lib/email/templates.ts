/** Default transactional email templates. Editable from Admin → Settings → Email templates. */
export const defaultEmailTemplates = {
  verify_email: {
    name: "Verify email address",
    subject: "Confirm your email for {{brandName}}",
    body: "Hi {{name}},\n\nPlease confirm your email address to finish creating your account:\n\n{{url}}\n\nIf you did not create an account, you can ignore this email.",
  },
  reset_password: {
    name: "Password reset",
    subject: "Reset your {{brandName}} password",
    body: "Hi {{name}},\n\nWe received a request to reset your password. This link is valid for one hour:\n\n{{url}}\n\nIf you did not request this, you can safely ignore this email — your password will not change.",
  },
  order_confirmation: {
    name: "Order confirmation",
    subject: "Order {{orderNumber}} confirmed",
    body: "Hi {{customerName}},\n\nThank you for your order! We have received your payment of {{total}}.\n\n{{items}}\n\nShipping to: {{shippingAddress}}\nShipping method: {{shippingMethod}}\n\nYou can view your order and its status here:\n{{orderUrl}}\n\nYou have the right to withdraw from this purchase within {{withdrawalDays}} days of delivery, as described in our Returns & Refunds policy: {{siteUrl}}/legal/returns\n\nQuestions? Reply to {{supportEmail}}.",
  },
  order_shipped: {
    name: "Order shipped",
    subject: "Your order {{orderNumber}} is on its way",
    body: "Hi {{customerName}},\n\nGood news — your order has shipped.\n\nCarrier: {{carrier}}\nTracking number: {{trackingNumber}}\n{{trackingUrl}}\n\nView your order: {{orderUrl}}",
  },
  order_delivered: {
    name: "Order delivered",
    subject: "Your order {{orderNumber}} has been delivered",
    body: "Hi {{customerName}},\n\nYour order has been marked as delivered. We hope your pet enjoys it!\n\nIf anything is wrong with your order, contact us at {{supportEmail}}.\n\nView your order: {{orderUrl}}",
  },
  order_cancelled: {
    name: "Order cancelled",
    subject: "Order {{orderNumber}} cancelled",
    body: "Hi {{customerName}},\n\nYour order {{orderNumber}} has been cancelled. {{reason}}\n\nIf a payment was taken, a full refund has been issued to your original payment method.",
  },
  refund_issued: {
    name: "Refund issued",
    subject: "Refund for order {{orderNumber}}",
    body: "Hi {{customerName}},\n\nWe have issued a refund of {{amount}} for order {{orderNumber}}. Depending on your bank, it may take 5–10 business days to appear on your statement.",
  },
  newsletter_confirm: {
    name: "Newsletter double opt-in",
    subject: "Please confirm your subscription to {{brandName}}",
    body: "Hi,\n\nPlease confirm that you want to receive emails about new products and offers from {{brandName}}:\n\n{{url}}\n\nIf you did not sign up, simply ignore this email and you will not be subscribed.",
  },
  support_received: {
    name: "Support request received",
    subject: "We received your message",
    body: "Hi {{name}},\n\nThanks for contacting {{brandName}}. We have received your message (\"{{subject}}\") and will reply as soon as possible.",
  },
  admin_alert: {
    name: "Admin alert",
    subject: "[Store alert] {{alertSubject}}",
    body: "{{alertMessage}}\n\nOpen the admin dashboard: {{siteUrl}}/admin",
  },
} as const;

export type EmailTemplateKey = keyof typeof defaultEmailTemplates;
export const emailTemplateKeys = Object.keys(defaultEmailTemplates) as EmailTemplateKey[];
