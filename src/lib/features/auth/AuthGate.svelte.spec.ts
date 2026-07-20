import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import AuthGate from './AuthGate.svelte';

describe('AuthGate', () => {
	it('shows a focused OTP sign-in state without the guest option', async () => {
		const onSubmitCode = vi.fn();

		render(AuthGate, {
			authError: null,
			code: '',
			codeSent: true,
			email: 'reader@example.com',
			isSigningIn: false,
			onBackToEmail: vi.fn(),
			onSignInAsGuest: vi.fn(),
			onSubmitCode,
			onSubmitEmail: vi.fn()
		});

		await expect
			.element(page.getByRole('heading', { name: 'Check your email' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('We sent a 6-digit sign-in code to reader@example.com.'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Continue as guest' }))
			.not.toBeInTheDocument();
		expect(document.querySelector('label[for="auth-code"]')).toBeNull();
		expect(document.querySelectorAll('[data-slot="input-otp-slot"]')).toHaveLength(6);
		expect(
			document.querySelector('[data-slot="input-otp"]')?.parentElement?.parentElement
		).toHaveClass('justify-center');
		await expect.element(page.getByRole('button', { name: 'Verify code' })).toBeDisabled();
		await page.getByLabelText('Verification code').fill('123456');
		await page.getByRole('button', { name: 'Verify code' }).click();

		expect(onSubmitCode).toHaveBeenCalledOnce();
	});

	it('offers guest access only before email sign-in starts', async () => {
		const onSignInAsGuest = vi.fn();

		render(AuthGate, {
			authError: null,
			code: '',
			codeSent: false,
			email: '',
			isSigningIn: false,
			onBackToEmail: vi.fn(),
			onSignInAsGuest,
			onSubmitCode: vi.fn(),
			onSubmitEmail: vi.fn()
		});

		await expect
			.element(page.getByRole('heading', { name: 'Sign in to Longbox' }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Continue as guest' }).click();

		expect(onSignInAsGuest).toHaveBeenCalledOnce();
	});

	it('lets the user request another code', async () => {
		const onSubmitEmail = vi.fn();

		render(AuthGate, {
			authError: null,
			code: '',
			codeSent: true,
			email: 'reader@example.com',
			isSigningIn: false,
			onBackToEmail: vi.fn(),
			onSignInAsGuest: vi.fn(),
			onSubmitCode: vi.fn(),
			onSubmitEmail
		});

		await page.getByRole('button', { name: 'Resend code' }).click();

		expect(onSubmitEmail).toHaveBeenCalledOnce();
	});
});
