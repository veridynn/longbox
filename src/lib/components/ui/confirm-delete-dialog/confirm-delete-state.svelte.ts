export type ConfirmDeleteOptions = {
	title: string;
	description: string;
	skipConfirmation?: boolean;
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

	constructor() {
		this.confirm = this.confirm.bind(this);
		this.cancel = this.cancel.bind(this);
	}

	newConfirmation(options: ConfirmDeleteOptions) {
		this.open = true;
		this.inputText = '';
		this.options = options;
	}

	confirm() {
		if (
			!this.options ||
			(this.options.input && this.inputText !== this.options.input.confirmationText)
		) {
			return;
		}

		this.loading = true;
		void this.options
			.onConfirm()
			.then(() => {
				this.open = false;
			})
			.catch(() => undefined)
			.finally(() => {
				this.loading = false;
			});
	}

	cancel() {
		this.options?.onCancel?.();
		this.open = false;
	}
}

export const dialogState = new ConfirmDeleteDialogState();

export function confirmDelete(options: ConfirmDeleteOptions) {
	if (options.skipConfirmation) {
		void options.onConfirm();
		return;
	}

	dialogState.newConfirmation(options);
}
