declare module 'vscode' {
  export type Thenable<T> = PromiseLike<T>;

  export interface Disposable {
    dispose(): any;
  }

  export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
  }

  export class EventEmitter<T> {
    event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }

  export interface Memento {
    get<T>(key: string, defaultValue?: T): T;
    update(key: string, value: any): Thenable<void>;
  }

  export interface ExtensionContext {
    subscriptions: Disposable[];
    extensionUri: Uri;
    workspaceState: Memento;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string, defaultValue?: T): T;
  }

  export interface ConfigurationChangeEvent {
    affectsConfiguration(section: string): boolean;
  }

  export namespace workspace {
    function getConfiguration(section?: string): WorkspaceConfiguration;
    function onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => any): Disposable;
    function openTextDocument(options: { language?: string; content?: string }): Thenable<TextDocument>;
  }

  export namespace env {
    const clipboard: {
      writeText(value: string): Thenable<void>;
    };
  }

  export namespace commands {
    function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;
    function executeCommand<T>(command: string, ...rest: any[]): Thenable<T>;
    function getCommands(filterInternal?: boolean): Thenable<string[]>;
  }

  export interface Extension<T> {
    activate(): Thenable<T>;
    exports: T;
  }

  export namespace extensions {
    function getExtension<T>(extensionId: string): Extension<T> | undefined;
  }

  export namespace window {
    const activeTextEditor: TextEditor | undefined;
    function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    function showTextDocument(document: TextDocument, options?: { preview?: boolean }): Thenable<TextEditor>;
    function createOutputChannel(name: string): OutputChannel;
    function registerWebviewViewProvider(viewType: string, provider: WebviewViewProvider, options?: any): Disposable;
    function showQuickPick(items: readonly QuickPickItem[] | Thenable<readonly QuickPickItem[]>, options?: QuickPickOptions): Thenable<QuickPickItem | undefined>;
  }

  export namespace Uri {
    function joinPath(base: Uri, ...pathSegments: string[]): Uri;
  }

  export interface Uri {
    readonly fsPath: string;
  }

  export interface OutputChannel extends Disposable {
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
  }

  export interface QuickPickItem {
    label: string;
    description?: string;
    [key: string]: any;
  }

  export interface QuickPickOptions {
    placeHolder?: string;
  }

  export interface WebviewViewProvider {
    resolveWebviewView(webviewView: WebviewView, context: any, token: any): void | Thenable<void>;
  }

  export interface WebviewView {
    readonly webview: Webview;
    show?(preserveFocus?: boolean): void;
  }

  export interface Webview {
    html: string;
    options: any;
    readonly cspSource: string;
    postMessage(message: any): Thenable<boolean>;
    onDidReceiveMessage(listener: (e: any) => any): Disposable;
    asWebviewUri(resource: Uri): Uri;
  }

  export interface TextDocument {
    getText(range?: Range): string;
    languageId: string;
    fileName: string;
    positionAt(offset: number): Position;
    uri: Uri;
  }

  export interface TextEditor {
    document: TextDocument;
    selection: Selection;
    edit(callback: (editBuilder: TextEditorEdit) => void | Thenable<void>): Thenable<boolean>;
    revealRange(range: Range, revealType?: TextEditorRevealType): void;
  }

  export interface TextEditorEdit {
    replace(location: Range, value: string): void;
    insert(position: Position, value: string): void;
  }

  export class Position {
    constructor(line: number, character: number);
  }

  export class Range {
    constructor(start: Position, end: Position);
    readonly start: Position;
    readonly end: Position;
  }

  export class Selection extends Range {
    readonly isEmpty: boolean;
    readonly active: Position;
    constructor(anchor: Position, active: Position);
  }

  export enum TextEditorRevealType {
    InCenter = 1
  }
}
