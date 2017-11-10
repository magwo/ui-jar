import * as ts from 'typescript';
import * as path from 'path';
import { SourceParser, SourceDocs } from '../generator/source-parser';
import { BundleTemplateWriter } from '../generator/bundle-writer';
import { FileSearch } from '../generator/file-search';
import { TestModuleTemplateWriter, TestModuleSourceFile } from '../generator/test-module-writer';
import { GeneratedSourceParser } from '../generator/generated-source-parser';
import { TestSourceParser } from '../generator/test-source-parser';
import { CliArgs } from '../cli/cli-utils';

interface ProjectDocumentation {
    docs: SourceDocs[];
    testDocs: any[];
}

function getProjectDocumentation(options: CliArgs): ProjectDocumentation {
    const fileSearch = new FileSearch(options.includes, options.excludes);
    const sourceFiles = fileSearch.getFiles(options.directory);

    let docs = getProjectSourceDocumentation(sourceFiles);
    let testDocs = getProjectTestDocumentation(sourceFiles, docs);

    return {
        docs,
        testDocs
    };
}

function getTestModuleSourceFilesData(testDocs: any[]): TestModuleSourceFile[] {
    return new TestModuleTemplateWriter().getTestModuleSourceFiles(testDocs);
}

export function generateSingleFile(options: CliArgs, fileName: string) {
    const generatedTestModuleSourceFilesData = getTestModuleSourceFilesData(getProjectDocumentation(options).testDocs);
    const updateCurrentSourceFile = generatedTestModuleSourceFilesData.filter((file) => {
        return new RegExp((fileName.replace(/\\/gi, '/').replace(/\./gi, '\\.') +'$')).test(file.fileName);
    });

    const testModuleTemplateWriter = new TestModuleTemplateWriter();

    const generatedTestModuleSourceFiles: ts.SourceFile[] = updateCurrentSourceFile.map((file) => {
        return file.sourceFile;
    });

    testModuleTemplateWriter.createTestModuleFiles(generatedTestModuleSourceFiles);
}


export function generateRequiredFiles(options: CliArgs) {
    console.info('Generating resources...');

    let { docs, testDocs } = getProjectDocumentation(options);
    const generatedTestModuleSourceFiles: ts.SourceFile[] = getTestModuleSourceFilesData(testDocs).map((file) => {
        return file.sourceFile;
    });
    
    let testModuleTemplateWriter = new TestModuleTemplateWriter();
    testModuleTemplateWriter.createTestModuleFiles(generatedTestModuleSourceFiles);

    let generatedSourceFileNames = generatedTestModuleSourceFiles.map((sourceFile) => {
        return sourceFile.fileName;
    });

    let generatedDocs = getGeneratedDocs(generatedSourceFileNames, generatedTestModuleSourceFiles);

    docs.forEach((componentDoc) => {
        generatedDocs.forEach((moduleDocs) => {
            if (moduleDocs.includeTestForComponent === componentDoc.componentRefName) {
                componentDoc.moduleDetails = {
                    moduleRefName: moduleDocs.moduleRefName,
                    fileName: moduleDocs.fileName
                };
            }
        });

        testDocs.forEach((testDoc) => {
            if (testDoc.includeTestForComponent === componentDoc.componentRefName) {
                componentDoc.examples = testDoc.examples;
                componentDoc.exampleTemplate = testDoc.exampleTemplate;
            }
        });
    });

    let fileWriter = new BundleTemplateWriter(docs, options.urlPrefix);

    try {
        fileWriter.createBundleFile();
    } catch (error) {
        console.error('Failed to generate resources:', error);
        return;
    }

    console.info('Generated resources successfully.');
}

function getProjectSourceDocumentation(sourceFiles) {
    const sourceParser = new SourceParser({ files: sourceFiles },
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    return sourceParser.getProjectSourceDocumentation();
}

function getProjectTestDocumentation(sourceFiles, docs) {
    const testSourceParser = new TestSourceParser({ files: sourceFiles },
        { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

    return testSourceParser.getProjectTestDocumentation(docs);
}

function getGeneratedDocs(generatedSourceFileNames, generatedTestModuleSourceFiles) {
    let generatedDocumentation = new GeneratedSourceParser(
        {
            files: generatedSourceFileNames,
            testSourceFiles: generatedTestModuleSourceFiles
        },
        {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.CommonJS
        }
    );

    return generatedDocumentation.getGeneratedDocumentation();
}