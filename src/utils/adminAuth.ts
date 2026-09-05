import { AdminAccount, Section, StoredAdminAccount } from '../types';

/**
 * Password handling for the in-app administrator accounts.
 *
 * ## Why there is a hash here at all
 *
 * The accounts live in Firestore, and `firestore.rules` has to allow every
 * signed-in client to *read* that collection -- the check happens in the
 * browser, because there is no server to do it. So whatever is stored is
 * readable by anyone who opens devtools.
 *
 * Storing the passwords themselves would therefore hand every teacher the
 * technicians' actual passwords, which people reuse. Storing a slow salted
 * hash does not make the gate stronger -- someone who can read the collection
 * can also just call the Firestore SDK directly and skip the UI entirely --
 * but it does stop the one genuinely damaging leak, which is the plaintext.
 *
 * Be clear about what this is: an accountability record and a guard against
 * accidents, not a security boundary. The boundary needs real per-user
 * sign-in; see the deployment notes in README.md and firestore.rules.
 *
 * ## Parameters
 *
 * PBKDF2-SHA256, 210,000 iterations, per-account 16-byte salt, 32-byte key --
 * the OWASP recommendation for PBKDF2-SHA256. Deliberately slow, because the
 * threat that is actually in scope is someone reading a hash out of the
 * database and grinding a short password against it offline.
 *
 * `crypto.subtle` needs a secure context: https, or localhost in development.
 * Firebase Hosting is https, so production is fine.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

/** The algorithm and cost a stored hash was produced with. */
export const PASSWORD_HASH_SCHEME = `pbkdf2-sha256-${PBKDF2_ITERATIONS}`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** A fresh random salt, base64. */
export function makeSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

/**
 * Derives the stored form of a password.
 *
 * Passwords are NOT trimmed or case-folded: a trailing space someone typed on
 * purpose is part of their password, and silently normalising it would make
 * the same string fail to verify depending on where it was typed.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    key,
    KEY_BITS
  );

  return bytesToBase64(new Uint8Array(bits));
}

/**
 * Length-safe equality.
 *
 * Not a meaningful defence here -- the attacker can read the hash directly, so
 * there is nothing for a timing side channel to reveal -- but comparing digests
 * with `===` in security code is the kind of thing that gets copied into
 * somewhere it does matter.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  account: Pick<StoredAdminAccount, 'passwordSalt' | 'passwordHash'>
): Promise<boolean> {
  try {
    const candidate = await hashPassword(password, account.passwordSalt);
    return constantTimeEquals(candidate, account.passwordHash);
  } catch (err) {
    // A malformed salt (hand-edited in the console, say) must fail closed and
    // must not take down the whole sign-in attempt for the other accounts.
    console.error('Password verification failed for one account:', err);
    return false;
  }
}

/**
 * Finds the account a typed password belongs to.
 *
 * Every account is tried, rather than stopping at the first match, so that two
 * accounts sharing a password behave predictably: the first in the list wins.
 * The caller is expected to prevent that from happening -- see
 * `isPasswordAlreadyUsed`.
 *
 * Runs the candidates in order and awaits each in turn. With PBKDF2 at 210k
 * iterations this is a few hundred milliseconds per account, so a school with
 * three or four of them is imperceptible; a school with fifty would want the
 * hash moved to a Cloud Function, at which point the whole model should change
 * to real sign-in anyway.
 */
export async function findMatchingAccount(
  password: string,
  accounts: StoredAdminAccount[]
): Promise<StoredAdminAccount | null> {
  for (const account of accounts) {
    if (await verifyPassword(password, account)) return account;
  }
  return null;
}

/**
 * Is this password already in use by another account?
 *
 * The whole point of separate accounts is that the modification history can
 * name one person, which a shared password destroys. Checked when an account
 * is created or its password changed; `exceptId` is the account being edited,
 * so keeping your own password is not reported as a clash.
 */
export async function isPasswordAlreadyUsed(
  password: string,
  accounts: StoredAdminAccount[],
  exceptId?: string
): Promise<boolean> {
  const others = accounts.filter(a => a.id !== exceptId);
  return (await findMatchingAccount(password, others)) !== null;
}

/** The public half of a stored account: what the audit trail records. */
export function toAdminAccount(stored: StoredAdminAccount): AdminAccount {
  return {
    id: stored.id,
    name: stored.name,
    ...(stored.section ? { section: stored.section as Section } : {})
  };
}

/**
 * Why a password is not acceptable, or `null` if it is.
 *
 * Deliberately mild. A school lab is a shared machine and an over-strict rule
 * produces a password on a sticky note next to it, which is worse than a short
 * one nobody wrote down. The floor is the length below which offline grinding
 * of the stored hash stops being work at all.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 8;

export function describePasswordProblem(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) {
    return 'Leading or trailing spaces are too easy to mistype — remove them.';
  }
  return null;
}
