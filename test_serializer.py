import subprocess
import sys

# Cai pypsrp 0.9.0
subprocess.check_call([sys.executable, "-m", "pip", "install", "pypsrp==0.9.0"])

import pypsrp.serializer
import inspect

print("--- Serializer methods ---")
print(dir(pypsrp.serializer.Serializer))

print("\n--- Serializer._serialize_string ---")
print(inspect.getsource(pypsrp.serializer.Serializer._serialize_string))

print("\n--- pypsrp.complex_objects.PSCredential ---")
import pypsrp.complex_objects
print(inspect.getsource(pypsrp.complex_objects.PSCredential))
