from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import SubmitField
from wtforms.validators import DataRequired


class UploadForm(FlaskForm):
    file = FileField("Select File(s)", validators=[DataRequired()])
    submit = SubmitField("Upload")