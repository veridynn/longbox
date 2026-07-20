import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import SaveAccountConfirmationDialog from './SaveAccountConfirmationDialog.svelte';

vi.mock('$app/navigation', () => ({ onNavigate: vi.fn() }));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const callbacks = {
		onBackToEmail: vi.fn(),
		onResendCode: vi.fn(),
		onSubmitCode: vi.fn(),
		onSubmitProfile: vi.fn()
	};

	render(SaveAccountConfirmationDialog, {
		code: '',
		email: 'reader@example.com',
		errorMessage: null,
		isSubmitting: false,
		open: true,
		profilePending: false,
		...callbacks,
		...overrides
	});

	return callbacks;
}

describe('SaveAccountConfirmationDialog', () => {
	it('confirms the emailed code in a centered OTP dialog', async () => {
		const callbacks = renderDialog();

		await expect
			.element(page.getByRole('heading', { name: 'Check your email' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('We sent a 6-digit confirmation code to reader@example.com.'))
			.toBeInTheDocument();
		expect(document.querySelector('label[for="save-account-confirmation-code"]')).toBeNull();
		expect(
			document.querySelector('[data-slot="input-otp"]')?.parentElement?.parentElement
		).toHaveClass('justify-center');
		await page.getByLabelText('Verification code').fill('123456');
		await page.getByRole('button', { name: 'Verify code' }).click();

		expect(callbacks.onSubmitCode).toHaveBeenCalledOnce();
	});

	it('returns to account setup to change the email', async () => {
		const callbacks = renderDialog();

		await page.getByRole('button', { name: 'Use a different email' }).click();

		expect(callbacks.onBackToEmail).toHaveBeenCalledOnce();
	});

	it('lets the user request another confirmation code', async () => {
		const callbacks = renderDialog();

		await page.getByRole('button', { name: 'Resend code' }).click();

		expect(callbacks.onResendCode).toHaveBeenCalledOnce();
	});

	it('keeps verified setup mounted for profile retry', async () => {
		const callbacks = renderDialog({
			errorMessage: 'Unable to save your profile.',
			profilePending: true
		});

		await expect
			.element(
				page.getByText('Your email is verified. Finish saving your profile to complete setup.')
			)
			.toBeInTheDocument();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to save your profile.');
		await expect.element(page.getByLabelText('Verification code')).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Finish setup' }).click();

		expect(callbacks.onSubmitProfile).toHaveBeenCalledOnce();
	});
});
