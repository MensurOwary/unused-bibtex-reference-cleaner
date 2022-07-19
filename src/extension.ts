// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as bibtexParser from '@retorquere/bibtex-parser';

let diagnosticCollection: vscode.DiagnosticCollection;

function report(currentDoc: vscode.TextDocument, missingKeys: string[], targetFile: vscode.Uri) {
	const diags: vscode.Diagnostic[] = [];

	for (let i = 0; i < currentDoc.lineCount; i++) {
		const line = currentDoc.lineAt(i).text;
		for (let key of missingKeys) {
			if (line.includes(key)) {
				const start = line.indexOf(key);
				const range = new vscode.Range(
					currentDoc.lineAt(i).lineNumber, 
					start, 
					currentDoc.lineAt(i).lineNumber, 
					start + key.length
				);

				diags.push(new vscode.Diagnostic(range, `Unused reference: '${key}'`, vscode.DiagnosticSeverity.Warning));
			}
		}
	}

	diagnosticCollection.set(targetFile, diags);
}

async function getAllReferencedKeys(files: vscode.Uri[], keys: string[]) {
	return files.map(async (uri) => {
		const bytes = await vscode.workspace.fs.readFile(uri);
		const string = Buffer.from(bytes).toString("utf-8");
		return keys.filter(key => string.includes(key));
	}).reduce((prev, currentValue, _, __) => {
		return Promise.all([prev, currentValue]).then(arr =>  arr.flat());
	});
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('clean-unused-citations.detect', async () => {
		diagnosticCollection.clear();
		
		const currentDoc = vscode.window.activeTextEditor?.document;
		if (currentDoc && currentDoc.fileName.endsWith(".bib")) {
			const filename = currentDoc.fileName;
			const text = currentDoc?.getText();

			// if current document has some text
			if (text) {
				// parse the contents
				const result = bibtexParser.parse(text);
				// only take the citation keys
				const keys = result.entries.map(e => e.key);
				// find all the .tex files in the folder
				const files = await vscode.workspace.findFiles("**/*.tex");
				// get all the keys that exist in the files
				const allFoundKeys = await getAllReferencedKeys(files, keys);
				const missingKeys = [...keys].filter(s => !allFoundKeys.includes(s));
				report(currentDoc, missingKeys, vscode.Uri.parse(vscode.Uri.file(filename).toString()));
			}
		} else {
			vscode.window.showWarningMessage("Only .bib files are supported");
		}
	});

	diagnosticCollection = vscode.languages.createDiagnosticCollection('unusedBibTexReports');
	context.subscriptions.push(disposable);
	context.subscriptions.push(diagnosticCollection);
}

// this method is called when your extension is deactivated
export function deactivate() {}
