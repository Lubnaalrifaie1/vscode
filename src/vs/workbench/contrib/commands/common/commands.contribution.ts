/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';

type RunnableCommand = string | { command: string; args: any[] };

type CommandArgs = {
	commands: RunnableCommand[];
};

/** Runs several commands passed to it as an argument */
class RunCommands extends Action2 {

	constructor() {
		super({
			id: 'runCommands',
			title: { value: nls.localize('runCommands', "Run Commands"), original: 'Run Commands' },
			f1: false,
			description: {
				description: nls.localize('runCommands.description', "Run several commands"),
				args: [
					{
						name: 'args',
						schema: {
							type: 'object',
							required: ['commands'],
							properties: {
								commands: {
									type: 'array',
									description: nls.localize('runCommands.commands', "Commands to run"),
									items: {
										anyOf: [  // Note: we don't allow arbitrary strings as command names as does `keybindingService.ts` - such behavior would be useful if the commands registry doesn't know about all existing commands - needs investigation
											{
												$ref: 'vscode://schemas/keybindings#commandNames'
											},
											{
												type: 'string', // we support "arbitrary" strings because extension-contributed command names aren't in 'vscode://schemas/keybindings#commandNames'
											},
											{
												type: 'object',
												required: ['command'],
												$ref: 'vscode://schemas/keybindings#/definitions/commandsSchemas'
											}
										]
									}
								}
							}
						}
					}
				]
			}
		});
	}

	// dev decisions:
	// - this command takes a single argument-object because
	//	- keybinding definitions don't allow running commands with several arguments
	//  - and we want to be able to take on different other arguments in future, e.g., `runMode : 'serial' | 'concurrent'`
	async run(accessor: ServicesAccessor, args: unknown) {
		if (!this._isCommandArgs(args)) {
			throw new Error('runCommands: invalid arguments');
		}
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);
		try {
			for (const cmd of args.commands) {
				await this._runCommand(commandService, cmd);
			}
		} catch (err) {
			notificationService.warn(err);
		}
	}

	private _isCommandArgs(args: unknown): args is CommandArgs {
		if (!args || typeof args !== 'object') {
			return false;
		}
		if (!('commands' in args) || !Array.isArray(args.commands)) {
			return false;
		}
		for (const cmd of args.commands) {
			if (typeof cmd === 'string') {
				continue;
			}
			if (typeof cmd === 'object' && typeof cmd.command === 'string') {
				continue;
			}
			return false;
		}
		return true;
	}

	private _runCommand(commandService: ICommandService, cmd: RunnableCommand) {
		let commandID: string, commandArgs;

		if (typeof cmd === 'string') {
			commandID = cmd;
		} else {
			commandID = cmd.command;
			commandArgs = cmd.args;
		}

		if (commandArgs === undefined) {
			return commandService.executeCommand(commandID);
		} else {
			if (Array.isArray(commandArgs)) { // TODO@ulugbekna: this needs discussion - do we allow passing several arguments to command run, which isn't by the regular `keybindings.json`
				return commandService.executeCommand(commandID, ...commandArgs);
			} else {
				return commandService.executeCommand(commandID, commandArgs);
			}
		}
	}
}

registerAction2(RunCommands);