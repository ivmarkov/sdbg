/*
 * Copyright (c) 2013, the Dart project authors.
 * 
 * Licensed under the Eclipse Public License v1.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 * 
 * http://www.eclipse.org/legal/epl-v10.html
 * 
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

package com.github.sdbg.debug.ui.internal.objectinspector;

import com.github.sdbg.debug.core.model.ISDBGValue;
import com.github.sdbg.debug.ui.internal.SDBGDebugUIPlugin;
import com.github.sdbg.debug.ui.internal.util.SelectionUtil;
import com.github.sdbg.ui.instrumentation.UIInstrumentation;
import com.github.sdbg.ui.instrumentation.UIInstrumentationBuilder;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;
import org.eclipse.jface.action.IAction;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.ui.IObjectActionDelegate;
import org.eclipse.ui.IWorkbenchPart;

/**
 * Open an object inspector on the given object's class.
 */
public class OpenNewLibraryInspectorAction implements IObjectActionDelegate {
  private ISelection selection;

  public OpenNewLibraryInspectorAction() {

  }

  @Override
  public void run(IAction action) {
    if (selection != null) {
      UIInstrumentationBuilder instrumentation = UIInstrumentation.builder(getClass());

      Object obj = SelectionUtil.getSingleElement(selection);

      try {
        instrumentation.record(selection);

        if (obj instanceof IVariable) {
          IVariable variable = (IVariable) obj;

          obj = variable.getValue();
        }

        if (obj instanceof ISDBGValue) {
          ISDBGValue value = (ISDBGValue) obj;

          IValue libraryValue = null; // &&& value.getLibraryValue();

          if (libraryValue != null) {
            ObjectInspectorView.inspect(libraryValue, true);
          }
        }
        // TODO(devoncarew): add support for inspecting stack frames
        /*else if (obj instanceof ServerDebugStackFrame) {
          ServerDebugStackFrame frame = (ServerDebugStackFrame) obj;

          IValue libraryValue = frame.getLibraryValue();

          if (libraryValue != null) {
            ObjectInspectorView.inspect(libraryValue);
          }
        }*/

        instrumentation.metric("Inspect", "Completed");
      } catch (DebugException e) {
        SDBGDebugUIPlugin.logError(e);
      } finally {
        instrumentation.log();
      }
    }
  }

  @Override
  public void selectionChanged(IAction action, ISelection selection) {
    this.selection = selection;
  }

  @Override
  public void setActivePart(IAction action, IWorkbenchPart targetPart) {

  }

}
