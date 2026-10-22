// Enquiry validation shared by the browser form and the server function,
// so both sides apply exactly the same rules.

export const LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  phone: { max: 20 },
  interest: { max: 80 },
  message: { min: 10, max: 2000 },
};

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
// UK numbers: 07…, 01…, 02…, 03…, or +44 forms. Spaces, dashes and brackets allowed.
const UK_PHONE_RE = /^(?:\+44\s?\(?0?\)?|0)\s?(?:\d[\s-]?){9,10}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function clean(value, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  let v = value.replace(CONTROL_RE, "");
  if (!multiline) v = v.replace(/[\r\n\t]+/g, " ");
  return v.trim();
}

export function validateEnquiry(input, allowedInterests = null) {
  const data = {
    name: clean(input.name),
    email: clean(input.email).toLowerCase(),
    phone: clean(input.phone),
    interest: clean(input.interest),
    message: clean(input.message, { multiline: true }),
    privacy: input.privacy === true || input.privacy === "on" || input.privacy === "true",
  };
  const errors = {};

  if (data.name.length < LIMITS.name.min) errors.name = "Please enter your full name.";
  else if (data.name.length > LIMITS.name.max) errors.name = "Please shorten your name to 100 characters or fewer.";

  if (!data.email) errors.email = "Please enter your email address so we can reply.";
  else if (data.email.length > LIMITS.email.max || !EMAIL_RE.test(data.email)) errors.email = "Please check your email address, for example name@example.com.";

  if (!data.phone) errors.phone = "Please enter a telephone number.";
  else if (data.phone.length > LIMITS.phone.max || !UK_PHONE_RE.test(data.phone)) errors.phone = "Please enter a UK number, for example 07123 456789.";

  if (!data.interest) errors.interest = "Please choose what your enquiry is about.";
  else if (data.interest.length > LIMITS.interest.max || (allowedInterests && !allowedInterests.includes(data.interest))) errors.interest = "Please choose an option from the list.";

  if (data.message.length < LIMITS.message.min) errors.message = "Please add a short message (at least 10 characters).";
  else if (data.message.length > LIMITS.message.max) errors.message = "Please keep your message under 2,000 characters.";

  if (!data.privacy) errors.privacy = "Please confirm you have read the privacy notice.";

  return { ok: Object.keys(errors).length === 0, data, errors };
}
