export type ConfirmDeleteOptions = {
	title: string;
	description: string;
	input?: {
		confirmationText: string;
	};
	confirm?: {
		text?: string;
	};
	cancel?: {
		text?: string;
	};
	onConfirm: () => Promise<unknown>;
	onCancel?: () => void;
};

class ConfirmDeleteDialogState {
	open = $state(false);
	inputText = $state('');
	options = $state<ConfirmDeleteOptions | null>(null);
	loading = $state(false);
	errorMessage = $state<string | null>(null);

	constructor() {
		this.confirm = this.confirm.bind(this);
		this.cancel = this.cancel.bind(this);
	}

	newConfirmation(options: ConfirmDeleteOptions) {
		this.open = true;
		this.inputText = '';
		this.errorMessage = null;
		this.options = options;
	}

	async confirm() {
		if (
			!this.options ||
			this.loading ||
			(this.options.input && this.inputText !== this.options.input.confirmationText)
		) {
			return;
		}

		this.loading = true;
		this.errorMessage = null;
		try {
			await this.options.onConfirm();
			this.open = false;
		} catch (error) {
			this.errorMessage =
				error instanceof Error ? error.message : 'Unable to complete this action.';
		} finally {
			this.loading = false;
		}
	}

	cancel() {
		this.options?.onCancel?.();
		this.errorMessage = null;
		this.open = false;
	}
}

export const dialogState = new ConfirmDeleteDialogState();

export function confirmDelete(options: ConfirmDeleteOptions) {
	dialogState.newConfirmation(options);
}
