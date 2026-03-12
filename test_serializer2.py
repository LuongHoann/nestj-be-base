import pypsrp.serializer
import inspect

print(inspect.getsource(pypsrp.serializer.Serializer._serialize_secure_string))

print("\n--- Try to find SecureString type ---")
import pypsrp.complex_objects as co
for name, obj in inspect.getmembers(co):
    if inspect.isclass(obj) and 'SecureStr' in name:
        print("Found:", name)
