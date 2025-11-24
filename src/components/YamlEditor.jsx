import React from 'react';
import Editor from '@monaco-editor/react';

const YamlEditor = ({ value, onChange, readOnly = false }) => {
    return (
        <div className="h-full w-full rounded-md overflow-hidden border border-white/10">
            <Editor
                height="100%"
                defaultLanguage="yaml"
                value={value}
                onChange={onChange}
                theme="vs-dark"
                options={{
                    readOnly: readOnly,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    padding: { top: 16, bottom: 16 },
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    automaticLayout: true,
                }}
            />
        </div>
    );
};

export default YamlEditor;
