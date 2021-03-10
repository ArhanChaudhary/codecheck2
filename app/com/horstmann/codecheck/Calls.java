package com.horstmann.codecheck;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Calls {
    
    public class Call {
        String name;
        String args;
        List<String> modifiers;
    }
    
    private Language language;
    private List<Call> calls = new ArrayList<>();
    private Path file;
    private int lastGroup = -1;

    public Calls(Language language) {
        this.language = language;
    }

    public Path getFile() {
        return file;
    }

    public int getSize() {
        return calls.size();
    }

    public Call getCall(int i) {
        return calls.get(i);
    }

    public void addCall(Path file, String args, String next) {
        if (this.file == null)
            this.file = file;
        else if (!this.file.equals(file))
            throw new CodeCheckException("CALL in " + this.file + " and " + file);
        Call c = new Call();
        c.args = args;
        calls.add(c);
        if (next.length() > 0) {
            String name = language.functionName(next);
            
            if (name == null)
                throw new CodeCheckException("No function below CALL in " + file + "\n" + next);
            List<String> modifiers = language.modifiers(next);
            for (int i = lastGroup + 1; i < calls.size(); i++) {
                Call callInGroup = calls.get(i);
                callInGroup.name = name;
                callInGroup.modifiers = modifiers;
            }
            lastGroup = calls.size() - 1;            
        } 
    }

    public Map<Path, String> writeTester(Map<Path, byte[]> solutionFiles) throws IOException {
        if (lastGroup < calls.size() - 1)
            throw new CodeCheckException("No function below CALL in " + file + "\n");
        String contents = new String(solutionFiles.get(file), StandardCharsets.UTF_8);
        return language.writeTester(file, contents, calls);
    }
}
