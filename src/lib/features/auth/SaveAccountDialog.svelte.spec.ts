import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import SaveAccountDialog from './SaveAccountDialog.svelte';

vi.mock('$app/navigation', () => ({ onNavigate: vi.fn() }));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const callbacks = {
		onBackToEmail: vi.fn(),
		onEmailBlur: vi.fn(),
		onEmailChange: vi.fn(),
		onSubmitCode: vi.fn(),
		onSubmitEmail: vi.fn(),
		onSubmitProfile: vi.fn()
	};

	render(SaveAccountDialog, {
		code: '',
		codeSent: false,
		email: '',
		emailAvailability: 'idle',
		errorMessage: null,
		imageFile: null,
		isSubmitting: false,
		name: 'Guest Reader',
		open: true,
		profileImageSrc: 'https://example.com/avatar.jpg',
		profilePending: false,
		removeImage: false,
		...callbacks,
		...overrides
	});

	return callbacks;
}

describe('SaveAccountDialog', () => {
	it('prefills required profile data and keeps the picture optional', async () => {
		renderDialog();

		await expect.element(page.getByLabelText('Display name')).toHaveValue('Guest Reader');
		await expect.element(page.getByAltText('Profile picture preview')).toBeInTheDocument();
		await page.getByLabelText('Display name').fill('');
		await page.getByLabelText('Email').fill('reader@example.com');
		await expect.element(page.getByRole('button', { name: 'Send code' })).toBeDisabled();
	});

	it('mutes labels for truly disabled fields', async () => {
		renderDialog({ isSubmitting: true });
		const label = page.getByText('Display name', { exact: true });

		expect(getComputedStyle(label.element()).opacity).toBe('0.5');
		expect(getComputedStyle(label.element()).pointerEvents).toBe('none');
		expect(document.activeElement).not.toBe(page.getByLabelText('Display name').element());
	});

	it('checks availability on blur and blocks unavailable email', async () => {
		const callbacks = renderDialog({ emailAvailability: 'unavailable' });

		await page.getByLabelText('Email').fill('used@example.com');
		page
			.getByLabelText('Email')
			.element()
			.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

		expect(callbacks.onEmailChange).toHaveBeenCalled();
		expect(callbacks.onEmailBlur).toHaveBeenCalledOnce();
		await expect.element(page.getByText('This email is already registered.')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Send code' })).toBeDisabled();
	});

	it('preserves profile controls through code verification', async () => {
		const callbacks = renderDialog({
			codeSent: true,
			email: 'reader@example.com',
			emailAvailability: 'available'
		});

		await expect.element(page.getByLabelText('Display name')).toHaveValue('Guest Reader');
		await expect.element(page.getByLabelText('Upload profile picture')).toBeInTheDocument();
		await page.getByLabelText('Verification code').fill('123456');
		await page.getByRole('button', { name: 'Save account' }).click();

		expect(callbacks.onSubmitCode).toHaveBeenCalledOnce();
	});

	it('keeps verified setup mounted for profile retry', async () => {
		const callbacks = renderDialog({
			email: 'reader@example.com',
			errorMessage: 'Unable to save your profile.',
			profilePending: true
		});

		await expect
			.element(
				page.getByText('Your email is verified. Finish saving your profile to complete setup.')
			)
			.toBeInTheDocument();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to save your profile.');
		await page.getByRole('button', { name: 'Finish setup' }).click();

		expect(callbacks.onSubmitProfile).toHaveBeenCalledOnce();
	});

	it('allows removing the optional profile picture', async () => {
		renderDialog();

		await page.getByRole('button', { name: 'Remove profile picture' }).click();

		await expect.element(page.getByAltText('Longbox logo')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Remove profile picture' }))
			.not.toBeInTheDocument();
	});
});
