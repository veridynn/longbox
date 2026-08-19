import { tick, untrack } from 'svelte';
import type { ReadableBoxedValues, WritableBoxedValues } from 'svelte-toolbelt';

type RenameInputStateProps = WritableBoxedValues<{
	mode: 'edit' | 'view';
	value: string;
	inputRef: HTMLInputElement | HTMLTextAreaElement | null;
}> &
	ReadableBoxedValues<{
		blurBehavior?: 'exit' | 'none';
		fallbackSelectionBehavior: 'start' | 'end' | 'all';
	}> & {
		onSave?: (value: string) => boolean | void | Promise<boolean | void>;
		onCancel?: () => void;
		validate: (value: string) => boolean;
	};

export class RenameInputState {
	mode = $state<'edit' | 'view'>('view');
	editingValue = $state('');
	invalid = $derived.by(() => !this.opts.validate(this.editingValue));

	get blurBehavior() {
		return this.opts.blurBehavior?.current ?? 'exit';
	}

	constructor(readonly opts: RenameInputStateProps) {
		this.mode = opts.mode.current;
		this.editingValue = opts.value.current;

		$effect(() => {
			void this.opts.mode.current;
			untrack(() => {
				if (this.mode === this.opts.mode.current) return;
				this.mode = this.opts.mode.current;
				if (this.mode === 'edit') void this.startEditing();
				else this.cancel();
			});
		});

		$effect(() => {
			this.opts.mode.current = this.mode;
		});
	}

	async startEditing(selection?: { start: number; end?: number }) {
		this.mode = 'edit';
		this.editingValue = this.opts.value.current;
		await tick();
		this.opts.inputRef.current?.focus();
		if (selection) {
			this.opts.inputRef.current?.setSelectionRange(
				selection.start,
				selection.end ?? selection.start
			);
			return;
		}

		const end = this.editingValue.length;
		const [start, finish] =
			this.opts.fallbackSelectionBehavior.current === 'all'
				? [0, end]
				: this.opts.fallbackSelectionBehavior.current === 'start'
					? [0, 0]
					: [end, end];
		this.opts.inputRef.current?.setSelectionRange(start, finish);
	}

	async save() {
		if (this.invalid) return;
		if ((await this.opts.onSave?.(this.editingValue)) === false) return;
		this.opts.value.current = this.editingValue;
		this.mode = 'view';
	}

	cancel() {
		this.mode = 'view';
		this.opts.onCancel?.();
		this.editingValue = this.opts.value.current;
	}

	onInputKeydown = async (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			await this.save();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.cancel();
		}
	};

	onInputBlur = () => {
		if (this.blurBehavior === 'exit') this.cancel();
	};

	onTextClick = async () => {
		await tick();
		const focusOffset = window.getSelection()?.focusOffset;
		await this.startEditing(focusOffset ? { start: focusOffset } : undefined);
	};
}
