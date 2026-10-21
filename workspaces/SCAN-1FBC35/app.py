import jinja2

def render_data(user_input):
    env = jinja2.Environment()
    template = env.from_string("Hello {{ name }}")
    return template.render(name=user_input)

def main():
    render_data("world")
