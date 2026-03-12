import pypsrp.serializer
print("TaggedValue exists:", hasattr(pypsrp.serializer, 'TaggedValue'))

if hasattr(pypsrp.serializer, 'TaggedValue'):
    import inspect
    print(inspect.getsource(pypsrp.serializer.TaggedValue))
