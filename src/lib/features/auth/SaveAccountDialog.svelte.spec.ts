import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import SaveAccountDialog from './SaveAccountDialog.svelte';

vi.mock('$app/navigation', () => ({ onNavigate: vi.fn() }));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const callbacks = {
		onCheckEmail: vi.fn(),
		onEmailChange: vi.fn(),
		onSubmitEmail: vi.fn()
	};

	render(SaveAccountDialog, {
		email: '',
		emailAvailability: 'idle',
		errorMessage: null,
		imageFile: null,
		isSubmitting: false,
		name: 'Guest Reader',
		open: true,
		profileImageSrc: 'https://example.com/avatar.jpg',
		removeImage: false,
		...callbacks,
		...overrides
	});

	return callbacks;
}

describe('SaveAccountDialog', () => {
	it('prefills required profile data and keeps the picture optional', async () => {
		renderDialog();

		await expect
			.element(
				page.getByText('A display name and email are required. Your profile picture is optional.')
			)
			.toBeInTheDocument();
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

	it('blocks an unavailable email', async () => {
		const callbacks = renderDialog({ emailAvailability: 'unavailable' });

		await page.getByLabelText('Email').fill('used@example.com');

		expect(callbacks.onEmailChange).toHaveBeenCalled();
		await expect.element(page.getByText('This email is already registered.')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Send code' })).toBeDisabled();
	});

	it('debounces availability checks for valid emails only', async () => {
		const callbacks = renderDialog();
		const email = page.getByLabelText('Email');

		await email.fill('not-an-email');
		await new Promise((resolve) => setTimeout(resolve, 450));
		expect(callbacks.onCheckEmail).not.toHaveBeenCalled();

		await email.fill('reader@example.com');
		await vi.waitFor(() => expect(callbacks.onCheckEmail).toHaveBeenCalledOnce());
	});

	it('submits the profile and email setup before confirmation', async () => {
		const callbacks = renderDialog({
			email: 'reader@example.com',
			emailAvailability: 'available'
		});

		await page.getByRole('button', { name: 'Send code' }).click();

		expect(callbacks.onSubmitEmail).toHaveBeenCalledOnce();
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
