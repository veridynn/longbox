import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import ProfileDialog from './ProfileDialog.svelte';

const navigation = vi.hoisted(() => ({ callbacks: [] as Array<() => void> }));
vi.mock('$app/navigation', () => ({
	onNavigate: (callback: () => void) => navigation.callbacks.push(callback)
}));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const onSubmit = vi.fn();

	render(ProfileDialog, {
		errorMessage: null,
		imageFile: null,
		initialName: 'Comic Reader',
		isSaving: false,
		name: 'Comic Reader',
		onSubmit,
		open: true,
		profileImageSrc: 'https://example.com/avatar.jpg',
		removeImage: false,
		...overrides
	});

	return { onSubmit };
}

describe('ProfileDialog', () => {
	it('unmounts its content when navigation starts', async () => {
		renderDialog();

		navigation.callbacks.at(-1)?.();

		await expect.element(page.getByRole('heading', { name: 'Profile' })).not.toBeInTheDocument();
	});

	it('shows only profile picture and display name fields', async () => {
		renderDialog();

		await expect.element(page.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Display name')).toHaveValue('Comic Reader');
		await expect.element(page.getByLabelText('Email', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Upload profile picture')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		await expect.element(page.getByText('Danger zone')).not.toBeInTheDocument();
		await expect.element(page.getByText('Profile details')).not.toBeInTheDocument();
		await expect.element(page.getByText('Account', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Profile picture URL')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Crop profile image' }))
			.not.toBeInTheDocument();
	});

	it('shows a clickable drop field when no picture exists', async () => {
		renderDialog({ profileImageSrc: '' });
		const input = document.querySelector<HTMLInputElement>('#profile-image')!;
		const onFileInputClick = vi.fn();
		input.addEventListener('click', onFileInputClick);

		await expect.element(page.getByLabelText('Profile picture preview')).toBeInTheDocument();
		await expect
			.element(page.getByAltText('Longbox logo'))
			.toHaveClass('rounded-full', 'grayscale', 'opacity-50');
		await expect.element(page.getByText('Drop image here to upload')).toBeInTheDocument();
		await expect
			.element(page.getByText('Drop image here to upload').element().parentElement!)
			.toHaveClass('absolute', 'opacity-0', 'group-hover:opacity-100');
		await expect.element(page.getByText('or click to choose a file')).toBeInTheDocument();
		await expect
			.element(page.getByLabelText('Upload profile picture'))
			.toHaveAttribute('for', 'profile-image');
		await expect
			.element(page.getByLabelText('Upload profile picture'))
			.toHaveClass('border-transparent', 'hover:border-muted-foreground/25', 'hover:bg-muted/30');
		await page.getByLabelText('Upload profile picture').click();
		expect(onFileInputClick).toHaveBeenCalledOnce();
	});

	it('centers the avatar in a vertically spacious drop target', async () => {
		renderDialog();
		const target = page.getByLabelText('Upload profile picture');
		const targetElement = target.element();
		await Promise.all(
			targetElement
				.closest('[data-slot="dialog-content"]')!
				.getAnimations()
				.map(({ finished }) => finished)
		);
		const avatar = targetElement.querySelector<HTMLElement>('[data-slot="avatar"]')!;
		const removeButton = page.getByRole('button', { name: 'Remove profile picture' }).element();
		const initialTargetRect = targetElement.getBoundingClientRect();
		const initialAvatarRect = avatar.getBoundingClientRect();
		const removeButtonRect = removeButton.getBoundingClientRect();

		await expect
			.element(target)
			.toHaveClass('flex', 'min-h-40', 'w-full', 'items-center', 'justify-center', 'border-2');
		await expect.element(target).toHaveClass('border-transparent');
		await expect.element(target).not.toHaveClass('hover:border-muted-foreground/25');
		expect(avatar).toHaveClass('rounded-full');
		expect(initialAvatarRect.left + initialAvatarRect.width / 2).toBeCloseTo(
			initialTargetRect.left + initialTargetRect.width / 2
		);
		expect(initialAvatarRect.top + initialAvatarRect.height / 2).toBeCloseTo(
			initialTargetRect.top + initialTargetRect.height / 2
		);
		expect(removeButtonRect.left + removeButtonRect.width / 2).toBeCloseTo(initialAvatarRect.right);
		expect(removeButtonRect.top + removeButtonRect.height / 2).toBeCloseTo(initialAvatarRect.top);
		expect(removeButton).toHaveClass('cursor-pointer', 'transition-none');
		expect(removeButton.className).not.toContain('active:');

		await page.getByRole('button', { name: 'Remove profile picture' }).click();
		const emptyTargetRect = targetElement.getBoundingClientRect();
		const emptyAvatarRect = targetElement
			.querySelector<HTMLElement>('[data-slot="avatar"]')!
			.getBoundingClientRect();

		expect(emptyTargetRect.width).toBe(initialTargetRect.width);
		expect(emptyTargetRect.height).toBe(initialTargetRect.height);
		expect(emptyAvatarRect.left + emptyAvatarRect.width / 2).toBeCloseTo(
			emptyTargetRect.left + emptyTargetRect.width / 2
		);
		expect(emptyAvatarRect.top + emptyAvatarRect.height / 2).toBeCloseTo(
			emptyTargetRect.top + emptyTargetRect.height / 2
		);
	});

	it('shows the drop target while an image is held anywhere over the window', async () => {
		renderDialog();
		const target = page.getByLabelText('Upload profile picture');
		const transfer = new DataTransfer();
		transfer.items.add(new File(['avatar'], 'profile-avatar.png', { type: 'image/png' }));
		const initialTargetRect = target.element().getBoundingClientRect();

		window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer }));
		await expect.element(target).toHaveAttribute('data-dragging', 'true');
		await expect.element(target).toHaveClass('border-2', 'border-muted-foreground/50');
		await expect.element(page.getByAltText('Profile picture preview')).toBeInTheDocument();
		await expect.element(page.getByText('Drop image here to upload')).toBeInTheDocument();
		const targetRect = target.element().getBoundingClientRect();
		const avatarRect = target
			.element()
			.querySelector<HTMLElement>('[data-slot="avatar"]')!
			.getBoundingClientRect();
		expect(targetRect.width).toBe(initialTargetRect.width);
		expect(targetRect.height).toBe(initialTargetRect.height);
		expect(avatarRect.left + avatarRect.width / 2).toBeCloseTo(
			targetRect.left + targetRect.width / 2
		);
		expect(avatarRect.top + avatarRect.height / 2).toBeCloseTo(
			targetRect.top + targetRect.height / 2
		);

		window.dispatchEvent(new DragEvent('dragleave', { dataTransfer: transfer }));
		await expect.element(target).toHaveAttribute('data-dragging', 'false');
		await expect.element(target).toHaveClass('border-transparent');
	});

	it('clears the drag highlight and previews a dropped image', async () => {
		renderDialog();
		const target = page.getByLabelText('Upload profile picture');
		const element = target.element();
		const transfer = new DataTransfer();
		transfer.items.add(new File(['avatar'], 'profile-avatar.png', { type: 'image/png' }));

		window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer }));
		element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));

		await expect.element(target).toHaveAttribute('data-dragging', 'false');
		await expect.element(page.getByAltText('Profile picture preview')).toBeInTheDocument();
	});

	it('submits the trimmed name without a new image', async () => {
		const { onSubmit } = renderDialog();

		await page.getByLabelText('Display name').fill('  New Reader  ');
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onSubmit).toHaveBeenCalledWith({
			imageFile: null,
			name: 'New Reader',
			removeImage: false
		});
	});

	it('marks the current profile picture for removal', async () => {
		const { onSubmit } = renderDialog();

		await page.getByRole('button', { name: 'Remove profile picture' }).click();

		await expect.element(page.getByAltText('Profile picture preview')).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Profile picture preview')).toBeInTheDocument();
		await expect.element(page.getByAltText('Longbox logo')).toHaveClass('opacity-50');
		await expect.element(page.getByText('Drop image here to upload')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onSubmit).toHaveBeenCalledWith({
			imageFile: null,
			name: 'Comic Reader',
			removeImage: true
		});
	});

	it('previews and submits an uploaded image', async () => {
		const imageFile = new File(['avatar'], 'profile-avatar.png', { type: 'image/png' });
		const { onSubmit } = renderDialog({ profileImageSrc: '' });
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		Object.defineProperty(input, 'files', { value: [imageFile] });
		input?.dispatchEvent(new Event('change', { bubbles: true }));

		await expect.element(page.getByAltText('Profile picture preview')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onSubmit).toHaveBeenCalledWith({
			imageFile,
			name: 'Comic Reader',
			removeImage: false
		});
	});

	it('reports unsupported files', async () => {
		const { onSubmit } = renderDialog();
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		expect(input).not.toBeNull();
		Object.defineProperty(input, 'files', {
			value: [new File(['profile'], 'profile.txt', { type: 'text/plain' })]
		});
		input?.dispatchEvent(new Event('change', { bubbles: true }));

		await expect.element(page.getByText('Unsupported image type: text/plain.')).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('shows save errors', async () => {
		renderDialog({ errorMessage: 'Unable to save this profile.' });

		await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to save this profile.');
	});
});
