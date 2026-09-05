/**
 * Offline checks for administrator password handling.
 *
 * This is the one part of the admin-account feature where being wrong is
 * quiet: a hash that always matches, or a salt that is not actually random,
 * looks exactly like a working sign-in until someone tries the wrong password.
 * So the properties are asserted directly rather than inferred from the UI.
 *
 * Node 20+ exposes the same WebCrypto API the browser does, so the module runs
 * here unmodified.
 *
 * Run with `npm run verify:admin`.
 */
import {
  makeSalt,
  hashPassword,
  verifyPassword,
  findMatchingAccount,
  isPasswordAlreadyUsed,
  describePasswordProblem,
  toAdminAccount,
  PASSWORD_HASH_SCHEME,
  MIN_ADMIN_PASSWORD_LENGTH
} from '../src/utils/adminAuth';
import type { StoredAdminAccount } from '../src/types';

let failures = 0;
const check = (label: string, cond: boolean, detail?: unknown) => {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log('        got:', JSON.stringify(detail));
  }
};

async function makeAccount(
  id: string,
  name: string,
  password: string,
  section?: 'boys' | 'girls'
): Promise<StoredAdminAccount> {
  const passwordSalt = makeSalt();
  const now = new Date().toISOString();
  return {
    id,
    name,
    ...(section ? { section } : {}),
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt),
    passwordScheme: PASSWORD_HASH_SCHEME,
    createdAt: now,
    createdBy: 'Test',
    updatedAt: now,
    passwordChangedAt: now
  };
}

async function main() {
  console.log('\n=== salts ===');
  {
    const salts = new Set(Array.from({ length: 50 }, () => makeSalt()));
    check('50 salts are 50 distinct values', salts.size === 50, salts.size);
    check('a salt is non-trivial in length', makeSalt().length >= 16, makeSalt().length);
  }

  console.log('\n=== hashing ===');
  {
    const salt = makeSalt();
    const a = await hashPassword('correct horse battery', salt);
    const b = await hashPassword('correct horse battery', salt);
    check('the same password and salt give the same hash', a === b);

    const c = await hashPassword('correct horse battery ', salt);
    check('a trailing space is a different password', a !== c);

    const d = await hashPassword('Correct horse battery', salt);
    check('case matters', a !== d);

    const e = await hashPassword('correct horse battery', makeSalt());
    check('a different salt gives a different hash for the same password', a !== e);

    check('the hash does not contain the password',
      !a.toLowerCase().includes('correct'), a);
    check('the hash is a fixed 44-char base64 digest', a.length === 44, a.length);
  }

  console.log('\n=== verification ===');
  {
    const account = await makeAccount('a1', 'Mr Khalid', 'sodium-hydroxide-99');

    check('the right password verifies',
      await verifyPassword('sodium-hydroxide-99', account));
    check('the wrong password does not',
      !(await verifyPassword('sodium-hydroxide-98', account)));
    check('an empty password does not',
      !(await verifyPassword('', account)));
    check('a password that is a prefix of the right one does not',
      !(await verifyPassword('sodium-hydroxide-9', account)));

    // A hand-edited or corrupted record must fail closed, not throw and not
    // pass. This is the shape a half-finished console edit leaves behind.
    const broken = { ...account, passwordHash: '' };
    check('a record with no hash rejects every password',
      !(await verifyPassword('sodium-hydroxide-99', broken)));
  }

  console.log('\n=== matching an account ===');
  {
    const khalid = await makeAccount('a1', 'Mr Khalid', 'boys-lab-key-1', 'boys');
    const noura = await makeAccount('a2', 'Ms Noura', 'girls-lab-key-2', 'girls');
    const accounts = [khalid, noura];

    const found = await findMatchingAccount('girls-lab-key-2', accounts);
    check('a password finds its own account', found?.id === 'a2', found?.id);
    check('it does not find someone else',
      (await findMatchingAccount('boys-lab-key-1', accounts))?.id === 'a1');
    check('an unknown password finds nobody',
      (await findMatchingAccount('not-a-password', accounts)) === null);
    check('an empty account list finds nobody',
      (await findMatchingAccount('boys-lab-key-1', [])) === null);

    // Attribution is the whole point of separate accounts, so the app blocks
    // a shared password at the point it would be created.
    check('a password already in use is reported',
      await isPasswordAlreadyUsed('boys-lab-key-1', accounts));
    check('a genuinely new password is not',
      !(await isPasswordAlreadyUsed('a-brand-new-one', accounts)));
    check('editing an account does not clash with its own password',
      !(await isPasswordAlreadyUsed('boys-lab-key-1', accounts, 'a1')));
    check('but it does clash with another account’s',
      await isPasswordAlreadyUsed('girls-lab-key-2', accounts, 'a1'));
  }

  console.log('\n=== the public half of an account ===');
  {
    const account = await makeAccount('a1', 'Mr Khalid', 'boys-lab-key-1', 'boys');
    const publicHalf = toAdminAccount(account) as unknown as Record<string, unknown>;
    check('the audit identity carries the name and school',
      publicHalf.id === 'a1' && publicHalf.name === 'Mr Khalid' &&
      publicHalf.section === 'boys', publicHalf);
    check('it carries no hash', !('passwordHash' in publicHalf), publicHalf);
    check('it carries no salt', !('passwordSalt' in publicHalf), publicHalf);

    const noSection = await makeAccount('a3', 'Administrator', 'some-long-password');
    check('an account with no school omits the key rather than storing undefined',
      !('section' in toAdminAccount(noSection)));
  }

  console.log('\n=== password rules ===');
  {
    check('a short password is rejected',
      describePasswordProblem('short') !== null);
    check(`exactly ${MIN_ADMIN_PASSWORD_LENGTH} characters is accepted`,
      describePasswordProblem('a'.repeat(MIN_ADMIN_PASSWORD_LENGTH)) === null);
    check('a leading space is rejected',
      describePasswordProblem(' has-a-space-at-the-front') !== null);
    check('a trailing space is rejected',
      describePasswordProblem('has-a-space-at-the-end ') !== null);
    check('an ordinary password is accepted',
      describePasswordProblem('lab-store-2026') === null);
  }

  console.log(
    failures === 0
      ? '\nAll admin auth checks passed.\n'
      : `\n${failures} admin auth check(s) FAILED.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
