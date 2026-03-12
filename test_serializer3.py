import pypsrp.serializer
import inspect

print(inspect.getsource(pypsrp.serializer.Serializer._get_tag_from_value))
print("\n--- Try to find where _serialize_secure_string is called ---")
print(inspect.getsource(pypsrp.serializer.Serializer.serialize))
